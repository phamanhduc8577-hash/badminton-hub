import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { MemberProfile, PendingHandover } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
import { useToast } from '../components/ToastProvider'
import { getPlayerRankDisplay, LOL_RANKS } from '../lib/ranks'
import { BottomSheet } from '../components/BottomSheet'
import { ConfirmSheet } from '../components/host/ConfirmSheet'
import { ActionListItem, ActionListDivider } from '../components/host/ActionListItem'
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Sparkles,
  Award,
  KeyRound,
  Edit2,
  RotateCcw,
  Trash2,
  Gift,
  MoreHorizontal,
  UserMinus,
  Loader2,
} from 'lucide-react'

interface AvatarOptimizePreview {
  changed: number
  failed: number
  beforeKb: number
  afterKb: number
  savedKb: number
}

const membershipShortLabel = (m: MemberProfile) =>
  m.role === 'HOST'
    ? 'Quản trị viên'
    : m.membershipType === 'FIXED'
    ? 'Cố định'
    : m.membershipType === 'PENDING_FIXED'
    ? 'Chờ duyệt'
    : 'Vãng lai'

export const MemberListView: React.FC = () => {
  const { user } = useAuthStore()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'FIXED' | 'PENDING' | 'CASUAL'>('FIXED')
  const [searchQuery, setSearchQuery] = useState('')

  // State for Host Manual Rank Editing Modal
  const [editingRankMember, setEditingRankMember] = useState<MemberProfile | null>(null)
  const [manualLpInput, setManualLpInput] = useState<number>(0)
  const [manualPlacementsInput, setManualPlacementsInput] = useState<number>(5)
  const [manualShieldInput, setManualShieldInput] = useState<number>(0)

  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<MemberProfile | null>(null)
  const [confirmResetPassMember, setConfirmResetPassMember] = useState<MemberProfile | null>(null)
  const [confirmDowngradeMember, setConfirmDowngradeMember] = useState<MemberProfile | null>(null)
  const [confirmUpgradeMember, setConfirmUpgradeMember] = useState<MemberProfile | null>(null)
  const [editingGenderMember, setEditingGenderMember] = useState<MemberProfile | null>(null)
  // Menu "⋯" trên mobile + xác nhận tối ưu ảnh
  const [actionMember, setActionMember] = useState<MemberProfile | null>(null)
  const [optimizePreview, setOptimizePreview] = useState<AvatarOptimizePreview | null>(null)

  // Trạng thái chờ duyệt / từ chối theo từng thành viên
  const [pendingMemberIds, setPendingMemberIds] = useState<Record<number, number>>({})
  const setMemberPending = (userId: number, on: boolean) =>
    setPendingMemberIds((prev) => {
      const next = { ...prev }
      const count = (next[userId] || 0) + (on ? 1 : -1)
      if (count <= 0) delete next[userId]
      else next[userId] = count
      return next
    })
  const isMemberPending = (userId: number) => !!pendingMemberIds[userId]

  const openRankEditor = (m: MemberProfile) => {
    setEditingRankMember(m)
    setManualLpInput(m.eloScore || 0)
    setManualPlacementsInput(m.placementMatches ?? 5)
    setManualShieldInput(m.shieldMatches ?? 0)
  }

  const openRestore = () => {
    refetchDeleted()
    setShowRestoreModal(true)
  }

  const { data: members = [], isLoading } = useQuery<MemberProfile[]>({
    queryKey: ['members'],
    queryFn: async () => {
      const res = await api.get('/members')
      return res.data
    },
    refetchInterval: false,
  })

  const { data: deletedMembers = [], isLoading: isLoadingDeleted, refetch: refetchDeleted } = useQuery<MemberProfile[]>({
    queryKey: ['deleted-members'],
    queryFn: async () => {
      const res = await api.get('/members/deleted')
      return res.data
    },
    enabled: user?.role === 'HOST',
  })

  // Danh sách quà vật lý đã đủ điều kiện nhưng Host chưa trao tận tay
  const { data: pendingHandovers = [] } = useQuery<PendingHandover[]>({
    queryKey: ['pending-handovers'],
    queryFn: async () => {
      const res = await api.get('/loyalty/pending-handovers')
      return res.data
    },
    enabled: user?.role === 'HOST',
    refetchOnMount: 'always',
  })

  const confirmHandoverMutation = useMutation({
    mutationFn: async (rewardId: number) => {
      const res = await api.post(`/loyalty/${rewardId}/handover`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-handovers'] })
      showToast('Đã ghi nhận trao quà thành công!', 'success')
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ['pending-handovers'] })
      showToast(err.response?.data?.message || 'Không thể xác nhận trao quà!', 'error')
    },
  })

  // Restore member mutation
  const restoreMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.post(`/members/${userId}/restore`)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['deleted-members'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboards'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard-sessions'] })
      showToast(`Đã khôi phục thành công tài khoản của ${data.fullName}!`, 'success')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể khôi phục thành viên!', 'error')
    },
  })

  // Mutations for Host
  const optimizeAvatarsMutation = useMutation({
    mutationFn: async (apply: boolean) => {
      const res = await api.post('/members/optimize-avatars', null, { params: { apply } })
      return res.data as {
        changed: number
        failed: number
        beforeKb: number
        afterKb: number
        savedKb: number
      }
    },
  })

  const handleOptimizeAvatars = async () => {
    try {
      const preview = await optimizeAvatarsMutation.mutateAsync(false)
      if (!preview.changed) {
        showToast('Không có ảnh đại diện nào cần thu nhỏ thêm.', 'info')
        return
      }
      setOptimizePreview(preview)
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Không thể tối ưu ảnh đại diện!', 'error')
    }
  }

  const handleApplyOptimizeAvatars = async () => {
    if (!optimizePreview) return
    try {
      await optimizeAvatarsMutation.mutateAsync(true)
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboards'] })
      showToast(`Đã thu nhỏ ${optimizePreview.changed} ảnh đại diện!`, 'success')
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Không thể tối ưu ảnh đại diện!', 'error')
    } finally {
      setOptimizePreview(null)
    }
  }

  // Mutations for Host
  const approveMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.post(`/members/${userId}/approve-fixed`)
      return res.data
    },
    onMutate: (userId: number) => setMemberPending(userId, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      showToast('Đã duyệt thành viên Cố Định thành công!')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể duyệt thành viên!', 'error')
    },
    onSettled: (_d, _e, userId) => {
      setMemberPending(userId, false)
      setActionMember((cur) => (cur?.id === userId ? null : cur))
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.post(`/members/${userId}/reject-fixed`)
      return res.data
    },
    onMutate: (userId: number) => setMemberPending(userId, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      showToast('Đã từ chối / chuyển thành viên về trạng thái Vãng Lai!', 'info')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Có lỗi xảy ra!', 'error')
    },
    onSettled: (_d, _e, userId) => {
      setMemberPending(userId, false)
      setActionMember((cur) => (cur?.id === userId ? null : cur))
    },
  })

  const updateTypeMutation = useMutation({
    mutationFn: async ({ userId, type }: { userId: number; type: string }) => {
      const res = await api.put(`/members/${userId}/membership-type`, { membershipType: type })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      showToast('Đã cập nhật phân loại thành viên!')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể đổi phân loại!', 'error')
    },
  })

  const updateGenderMutation = useMutation({
    mutationFn: async ({ userId, gender }: { userId: number; gender: 'MALE' | 'FEMALE' }) => {
      const res = await api.put(`/members/${userId}/gender`, { gender })
      return res.data as MemberProfile
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboards'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['session'] })
      setEditingGenderMember(null)
      showToast(
        `Đã đổi giới tính của ${data.fullName} thành ${data.gender === 'FEMALE' ? 'Nữ' : 'Nam'}. Giá các ca chưa thanh toán đã được tính lại.`,
        'success'
      )
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể đổi giới tính!', 'error')
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.post(`/members/${userId}/reset-password`)
      return res.data
    },
    onSuccess: (data) => {
      showToast(data.message || 'Đã đặt lại mật khẩu về 123456 thành công!')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể đặt lại mật khẩu!', 'error')
    },
  })

  // Host Delete Member Mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.delete(`/members/${userId}`)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboards'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard-sessions'] })
      showToast(data?.message || 'Đã xóa tài khoản thành viên thành công!')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể xóa thành viên!', 'error')
    },
  })

  // Host Manual Rank Override Mutation
  const updateRankMutation = useMutation({
    mutationFn: async ({
      userId,
      eloScore,
      placementMatches,
      shieldMatches,
    }: {
      userId: number
      eloScore: number
      placementMatches: number
      shieldMatches: number
    }) => {
      const res = await api.put(`/members/${userId}/rank`, { eloScore, placementMatches, shieldMatches })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboards'] })
      setEditingRankMember(null)
      showToast('Đã cập nhật Bậc Rank & LP cho thành viên thành công!')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể cập nhật Rank!', 'error')
    },
  })

  // Filter lists
  const fixedMembers = members.filter((m) => m.membershipType === 'FIXED' || m.role === 'HOST')
  const pendingMembers = members.filter((m) => m.membershipType === 'PENDING_FIXED')
  const casualMembers = members.filter((m) => m.membershipType === 'CASUAL' && m.role !== 'HOST')

  const currentList =
    activeTab === 'FIXED'
      ? fixedMembers
      : activeTab === 'PENDING'
      ? pendingMembers
      : casualMembers

  const filteredList = currentList.filter((m) => {
    const nameMatch = m.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    const phoneMatch = m.phone ? m.phone.includes(searchQuery) : false
    return nameMatch || phoneMatch
  })

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="saas-card rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Danh Sách Thành Viên Làng Địa Ngục
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <DuckMascot size={56} rounded="2xl" className="shadow-md border border-slate-200" />
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div
          className={`grid gap-3 pt-6 mt-6 border-t border-slate-200/80 text-xs ${
            user?.role === 'HOST' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
          }`}
        >
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
            <span className="text-[11px] font-bold text-emerald-800 block">🟢 Thành viên Cố định</span>
            <span className="text-xl font-black text-emerald-950 mt-0.5 block">{fixedMembers.length} người</span>
          </div>

          {user?.role === 'HOST' && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl">
              <span className="text-[11px] font-bold text-amber-800 block">⏳ Đang chờ duyệt</span>
              <span className="text-xl font-black text-amber-950 mt-0.5 block">{pendingMembers.length} người</span>
            </div>
          )}

          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl">
            <span className="text-[11px] font-bold text-blue-800 block">🟡 Khách vãng lai</span>
            <span className="text-xl font-black text-blue-950 mt-0.5 block">{casualMembers.length} người</span>
          </div>
        </div>

        {user?.role === 'HOST' && (
          <div className="pt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={openRestore}
              className="min-h-11 sm:min-h-0 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs sm:text-[11px] font-bold transition active:scale-95 flex items-center gap-1.5"
              title="Xem danh sách và khôi phục các thành viên đã lỡ xóa"
            >
              <RotateCcw size={13} />
              <span>Khôi phục thành viên</span>
              {deletedMembers.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px]">
                  {deletedMembers.length}
                </span>
              )}
            </button>
            <button
              onClick={handleOptimizeAvatars}
              disabled={optimizeAvatarsMutation.isPending}
              title="Thu nhỏ ảnh đại diện cũ để giảm băng thông"
              className="min-h-11 sm:min-h-0 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-[11px] font-bold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {optimizeAvatarsMutation.isPending ? 'Đang xử lý...' : '🖼️ Tối ưu ảnh đại diện'}
            </button>
          </div>
        )}
      </div>

      {/* Quà cần trao: chỉ Host thấy */}
      {user?.role === 'HOST' && pendingHandovers.length > 0 && (
        <div className="saas-card rounded-3xl p-6 space-y-4 border border-amber-200 bg-amber-50/40">
          <div className="flex items-center justify-between pb-3 border-b border-amber-200/80">
            <div className="flex items-center gap-2">
              <Gift size={16} className="text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">Quà cần trao tận tay</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black">
                {pendingHandovers.length}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Bấm "Đã trao" sau khi đưa quà cho thành viên
            </span>
          </div>

          <div className="divide-y divide-amber-100">
            {pendingHandovers.map((h) => (
              <div key={h.rewardId} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <DuckMascot
                    src={h.avatarUrl || '/duck-mascot.png'}
                    size={36}
                    rounded="xl"
                    className="border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 text-sm block truncate">{h.fullName}</span>
                    <span className="text-[11px] text-slate-500">
                      {h.phone ? `${h.phone} • ` : ''}đã đi {h.sessionsAttended} buổi
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-900 block">{h.rewardName}</span>
                    <span className="text-[10px] text-amber-700 font-bold">Mốc {h.milestoneSessions} buổi</span>
                  </div>
                  <button
                    onClick={() => confirmHandoverMutation.mutate(h.rewardId)}
                    disabled={confirmHandoverMutation.isPending}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl flex items-center gap-1 shadow-sm active:scale-95 transition disabled:opacity-60 cursor-pointer"
                  >
                    <CheckCircle2 size={13} />
                    <span>Đã trao</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto no-scrollbar touch-pan-x">
          <button
            onClick={() => setActiveTab('FIXED')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'FIXED'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>🟢 Thành viên Cố định</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-400/20 text-emerald-300 font-black">
              {fixedMembers.length}
            </span>
          </button>

          {user?.role === 'HOST' && (
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>⏳ Chờ duyệt cố định</span>
              {pendingMembers.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
                  {pendingMembers.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('CASUAL')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'CASUAL'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>🟡 Khách Vãng lai</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
              {casualMembers.length}
            </span>
          </button>
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-auto sm:min-w-[240px]">
          <Search className="absolute left-3.5 top-2.5 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc SĐT..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-sm font-medium"
          />
        </div>
      </div>

      {/* Member Roster Card */}
      <div className="saas-card rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-900" />
            <h2 className="text-sm font-bold text-slate-900">
              {activeTab === 'FIXED'
                ? 'Danh sách Thành Viên Cố Định (Chính thức)'
                : activeTab === 'PENDING'
                ? 'Yêu cầu đăng ký Thành Viên Cố Định (Chờ Host phê duyệt)'
                : 'Danh sách Thành Viên / Khách Vãng Lai'}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Hiển thị {filteredList.length} thành viên</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-xs font-semibold animate-pulse">
            Đang tải dữ liệu danh sách thành viên...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-14 text-center text-slate-500 text-xs space-y-2">
            <DuckMascot size={40} rounded="xl" className="mx-auto opacity-60" />
            <p className="font-semibold">Không tìm thấy thành viên nào phù hợp.</p>
          </div>
        ) : (
          <>
          {/* Mobile: thẻ từng thành viên + menu "⋯" */}
          <ul className="md:hidden divide-y divide-slate-100 -mx-2" aria-label="Danh sách thành viên">
            {filteredList.map((m) => {
              const rankDisplay = getPlayerRankDisplay(m.eloScore || 0, m.placementMatches ?? 5, m.shieldMatches ?? 0)
              const pending = isMemberPending(m.id)
              return (
                <li key={m.id} className="px-2 py-3 flex items-start gap-3" aria-busy={pending || undefined}>
                  <DuckMascot
                    src={m.avatarUrl || '/duck-mascot.png'}
                    size={40}
                    rounded="xl"
                    className="border border-slate-200 shadow-2xs shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-slate-900 text-sm truncate">{m.fullName}</span>
                      {m.role === 'HOST' && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded font-black shrink-0">
                          👑 Host
                        </span>
                      )}
                    </div>
                    {m.phone && <span className="block text-xs text-slate-500">{m.phone}</span>}
                    <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded-md border ${
                          m.gender === 'FEMALE'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {m.gender === 'FEMALE' ? 'Nữ' : 'Nam'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md border ${
                          m.membershipType === 'FIXED' || m.role === 'HOST'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : m.membershipType === 'PENDING_FIXED'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {membershipShortLabel(m)}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-md border ${rankDisplay.bgClass} ${rankDisplay.borderClass} ${rankDisplay.textColor}`}>
                        {rankDisplay.name} · {m.eloScore || 0} LP
                      </span>
                    </div>
                    <span className="block text-xs text-slate-600 font-medium">
                      {m.sessionsAttended} ca · {m.winCount}W - {m.lossCount}L
                    </span>
                    {pending && (
                      <span className="flex items-center gap-1 text-xs font-bold text-slate-500">
                        <Loader2 size={12} className="animate-spin" /> Đang xử lý...
                      </span>
                    )}
                  </div>
                  {user?.role === 'HOST' && (
                    <button
                      type="button"
                      onClick={() => setActionMember(m)}
                      disabled={pending}
                      aria-label={`Thao tác cho ${m.fullName}`}
                      className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition shrink-0 disabled:opacity-50"
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider bg-slate-50/50">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">{user?.role === 'HOST' ? 'Họ và tên / SĐT' : 'Họ và tên'}</th>
                  <th className="py-3 px-3">Giới tính</th>
                  <th className="py-3 px-3">Phân loại</th>
                  <th className="py-3 px-3">Chuyên cần</th>
                  <th className="py-3 px-3">Thắng / Thua</th>
                  <th className="py-3 px-3">ELO Trình độ</th>
                  {user?.role === 'HOST' && <th className="py-3 px-3 text-right">Thao tác Host</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredList.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-3 font-bold text-slate-400">{idx + 1}</td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-3">
                        <DuckMascot
                          src={m.avatarUrl || '/duck-mascot.png'}
                          size={36}
                          rounded="xl"
                          className="border border-slate-200 shadow-2xs shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-sm">{m.fullName}</span>
                            {m.role === 'HOST' && (
                              <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded font-black">
                                👑 Host CLB
                              </span>
                            )}
                          </div>
                          {m.phone && <span className="text-[11px] text-slate-500">{m.phone}</span>}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      {(() => {
                        const badgeClass = `text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 whitespace-nowrap text-center ${
                          m.gender === 'FEMALE'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`
                        const label = m.gender === 'FEMALE' ? 'Nữ (Trợ giá)' : 'Nam'
                        return user?.role === 'HOST' ? (
                          <button
                            type="button"
                            onClick={() => setEditingGenderMember(m)}
                            className={`${badgeClass} min-h-8 px-2.5 cursor-pointer hover:brightness-95 active:scale-95 transition`}
                            title="Sửa giới tính (Host)"
                            aria-label={`Sửa giới tính của ${m.fullName}, hiện tại: ${label}`}
                          >
                            <span>{label}</span>
                            <Edit2 size={10} className="opacity-70" />
                          </button>
                        ) : (
                          <span className={badgeClass}>{label}</span>
                        )
                      })()}
                    </td>

                    <td className="py-3.5 px-3">
                      {m.role === 'HOST' ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-900 text-white shadow-2xs inline-block whitespace-nowrap text-center">
                          Quản trị viên
                        </span>
                      ) : m.membershipType === 'FIXED' ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit whitespace-nowrap">
                          <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                          <span>Cố định (Chính thức)</span>
                        </span>
                      ) : m.membershipType === 'PENDING_FIXED' ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1 w-fit animate-pulse whitespace-nowrap">
                          <Clock size={12} className="text-amber-600 shrink-0" />
                          <span>Chờ Host duyệt</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 w-fit whitespace-nowrap">
                          <span>Vãng lai</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="font-bold text-slate-900 block">{m.sessionsAttended} ca</span>
                      <span className="text-[10px] text-slate-500">đã tham gia</span>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="font-bold text-slate-900 block">
                        {m.winCount} Win - {m.lossCount} Lose
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold">{m.winRate}% Thắng</span>
                    </td>

                    <td className="py-3.5 px-3">
                      {(() => {
                        const rankDisplay = getPlayerRankDisplay(m.eloScore || 0, m.placementMatches ?? 5, m.shieldMatches ?? 0)
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${rankDisplay.bgClass} ${rankDisplay.borderClass} ${rankDisplay.textColor}`}
                            >
                              {rankDisplay.name}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-slate-700">
                              {m.eloScore || 0} LP
                            </span>
                            {(m.shieldMatches ?? 0) > 0 && (
                              <span
                                title={`${m.shieldMatches} trận giáp bảo vệ`}
                                className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-300 font-extrabold text-[9px]"
                              >
                                🛡️ {m.shieldMatches}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </td>

                    {/* Host Controls */}
                    {user?.role === 'HOST' && (
                      <td className="py-3.5 px-3 text-right">
                        {m.role === 'HOST' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openRankEditor(m)}
                              className="p-1.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 rounded-xl transition border border-slate-200"
                              title="Chỉnh sửa Bậc Rank / LP trực tiếp cho Host"
                            >
                              <Award size={13} className="text-amber-600" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Nút Host Chỉnh Sửa Rank trực tiếp */}
                            <button
                              onClick={() => openRankEditor(m)}
                              className="p-1.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 rounded-xl transition border border-slate-200"
                              title="Chỉnh sửa Bậc Rank / LP trực tiếp cho người chơi"
                            >
                              <Award size={13} className="text-amber-600" />
                            </button>

                            {/* Nút Host Reset Mật khẩu nhanh */}
                            <button
                              onClick={() => setConfirmResetPassMember(m)}
                              disabled={resetPasswordMutation.isPending}
                              className="p-1.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 rounded-xl transition border border-slate-200"
                              title="Reset mật khẩu về 123456"
                            >
                              <KeyRound size={13} />
                            </button>

                            {m.membershipType === 'PENDING_FIXED' ? (
                              <>
                                <button
                                  onClick={() => approveMutation.mutate(m.id)}
                                  disabled={isMemberPending(m.id)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl flex items-center gap-1 shadow-sm active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Duyệt người này làm Thành Viên Cố Định"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>{isMemberPending(m.id) ? 'Đang xử lý...' : 'Duyệt Cố Định'}</span>
                                </button>

                                <button
                                  onClick={() => rejectMutation.mutate(m.id)}
                                  disabled={isMemberPending(m.id)}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-xl flex items-center gap-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Từ chối và giữ ở trạng thái Vãng Lai"
                                >
                                  <XCircle size={13} />
                                  <span>Từ chối</span>
                                </button>
                              </>
                            ) : m.membershipType === 'FIXED' ? (
                              <button
                                onClick={() => setConfirmDowngradeMember(m)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-[11px] rounded-xl border border-slate-200 transition"
                                title="Hạ cấp về Khách Vãng Lai"
                              >
                                <span>Chuyển về Vãng Lai</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmUpgradeMember(m)}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1"
                                title="Level Up lên Thành Viên Cố Định"
                              >
                                <Sparkles size={12} className="text-amber-300" />
                                <span>Level Up Cố Định</span>
                              </button>
                            )}

                            {/* Nút Xóa Thành Viên (tách xa nút Level Up) */}
                            <button
                              onClick={() => setConfirmDeleteMember(m)}
                              disabled={deleteMemberMutation.isPending}
                              className="ml-3 p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 rounded-xl transition border border-rose-200 shadow-2xs"
                              title="Xóa tài khoản thành viên này (Có thể khôi phục)"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Mobile: menu thao tác "⋯" cho 1 thành viên (Xóa luôn nằm cuối, màu đỏ) */}
      <BottomSheet
        open={!!actionMember}
        onClose={() => setActionMember(null)}
        title={actionMember ? `Thao tác: ${actionMember.fullName}` : undefined}
        ariaLabel="Thao tác thành viên"
      >
        {actionMember && (
          <ul className="space-y-1 -mx-2" aria-label="Danh sách thao tác">
            <ActionListItem
              icon={<Award size={18} className="text-amber-600" />}
              label="Chỉnh Rank & LP"
              hint={`${actionMember.eloScore || 0} LP`}
              onClick={() => {
                const m = actionMember
                setActionMember(null)
                openRankEditor(m)
              }}
            />
            {actionMember.role !== 'HOST' && (
              <>
                <ActionListItem
                  icon={<KeyRound size={18} />}
                  label="Đặt lại mật khẩu"
                  hint="Về mặc định 123456"
                  onClick={() => {
                    setConfirmResetPassMember(actionMember)
                    setActionMember(null)
                  }}
                />
                <ActionListItem
                  icon={<Edit2 size={18} />}
                  label="Đổi giới tính"
                  hint={`Hiện tại: ${actionMember.gender === 'FEMALE' ? 'Nữ' : 'Nam'}`}
                  onClick={() => {
                    setEditingGenderMember(actionMember)
                    setActionMember(null)
                  }}
                />
                {actionMember.membershipType === 'PENDING_FIXED' ? (
                  <>
                    <ActionListItem
                      icon={
                        isMemberPending(actionMember.id) ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={18} className="text-emerald-600" />
                        )
                      }
                      label={isMemberPending(actionMember.id) ? 'Đang xử lý...' : 'Duyệt Cố Định'}
                      disabled={isMemberPending(actionMember.id)}
                      onClick={() => approveMutation.mutate(actionMember.id)}
                    />
                    <ActionListItem
                      icon={<XCircle size={18} />}
                      label="Từ chối (giữ Vãng Lai)"
                      disabled={isMemberPending(actionMember.id)}
                      onClick={() => rejectMutation.mutate(actionMember.id)}
                    />
                  </>
                ) : actionMember.membershipType === 'FIXED' ? (
                  <ActionListItem
                    icon={<UserMinus size={18} />}
                    label="Chuyển về Vãng Lai"
                    onClick={() => {
                      setConfirmDowngradeMember(actionMember)
                      setActionMember(null)
                    }}
                  />
                ) : (
                  <ActionListItem
                    icon={<Sparkles size={18} className="text-amber-500" />}
                    label="Level Up Cố Định"
                    onClick={() => {
                      setConfirmUpgradeMember(actionMember)
                      setActionMember(null)
                    }}
                  />
                )}
                <ActionListDivider />
                <ActionListItem
                  icon={<Trash2 size={18} />}
                  label="Xóa tài khoản"
                  hint="Có thể khôi phục lại"
                  destructive
                  onClick={() => {
                    setConfirmDeleteMember(actionMember)
                    setActionMember(null)
                  }}
                />
              </>
            )}
          </ul>
        )}
      </BottomSheet>

      {/* Host Manual Rank Editor */}
      <BottomSheet
        open={!!editingRankMember}
        onClose={() => !updateRankMutation.isPending && setEditingRankMember(null)}
        closeOnBackdrop={!updateRankMutation.isPending}
        title={editingRankMember ? `Chỉnh Rank & LP: ${editingRankMember.fullName}` : undefined}
        ariaLabel="Chỉnh Rank & LP"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setEditingRankMember(null)}
              disabled={updateRankMutation.isPending}
              className="min-h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm sm:text-xs rounded-xl transition disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              disabled={updateRankMutation.isPending}
              onClick={() => {
                if (!editingRankMember) return
                updateRankMutation.mutate({
                  userId: editingRankMember.id,
                  eloScore: manualLpInput,
                  placementMatches: manualPlacementsInput,
                  shieldMatches: manualShieldInput,
                })
              }}
              className="min-h-11 bg-slate-950 hover:bg-slate-800 text-white font-black text-sm sm:text-xs rounded-xl shadow active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateRankMutation.isPending ? 'Đang lưu...' : 'Lưu Bậc Rank'}
            </button>
          </div>
        }
      >
        {editingRankMember && (
          <div className="space-y-4 text-sm sm:text-xs">
            <div>
              <label htmlFor="rank-lp-input" className="block text-slate-700 font-bold mb-1.5">
                Điểm LP Tích Lũy Tổng (Total LP):
              </label>
              <input
                id="rank-lp-input"
                type="number"
                inputMode="numeric"
                step="10"
                min="0"
                value={manualLpInput}
                onChange={(e) => setManualLpInput(Math.max(0, Number(e.target.value)))}
                className="w-full min-h-11 border border-slate-300 rounded-xl px-3 text-slate-900 font-mono font-bold text-base focus:outline-none focus:border-slate-900"
              />
            </div>

            {/* Quick LP Tier Select Buttons for Host Convenience */}
            <div>
              <span className="block text-slate-500 font-bold text-[11px] mb-1.5">Gợi ý chọn mốc Rank nhanh:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {LOL_RANKS.map((r) => (
                  <button
                    key={r.tier}
                    type="button"
                    onClick={() => setManualLpInput(r.minScore)}
                    className={`min-h-10 px-2 py-1.5 rounded-lg border text-[11px] font-black transition ${
                      manualLpInput >= r.minScore && manualLpInput <= r.maxScore
                        ? 'bg-slate-950 text-white border-slate-950'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {r.badge} ({r.minScore} LP)
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="rank-placement-select" className="block text-slate-700 font-bold mb-1.5">
                Trạng thái trận Phân Hạng (0..5 trận):
              </label>
              <select
                id="rank-placement-select"
                value={manualPlacementsInput}
                onChange={(e) => setManualPlacementsInput(Number(e.target.value))}
                className="w-full min-h-11 border border-slate-300 rounded-xl px-2.5 text-slate-900 font-bold focus:outline-none focus:border-slate-900 bg-white"
              >
                <option value={5}>✅ Đã hoàn thành phân hạng (Hiện Bậc Rank & Đoàn)</option>
                <option value={0}>⏳ Chưa đánh trận nào (0/5)</option>
                <option value={1}>⏳ Đã đánh 1 trận (1/5)</option>
                <option value={2}>⏳ Đã đánh 2 trận (2/5)</option>
                <option value={3}>⏳ Đã đánh 3 trận (3/5)</option>
                <option value={4}>⏳ Đã đánh 4 trận (4/5)</option>
              </select>
            </div>

            <div>
              <label htmlFor="rank-shield-input" className="block text-slate-700 font-bold mb-1.5">
                Số trận Giáp Bảo Vệ Rank (Demotion Shield):
              </label>
              <input
                id="rank-shield-input"
                type="number"
                inputMode="numeric"
                min="0"
                max="10"
                value={manualShieldInput}
                onChange={(e) => setManualShieldInput(Math.max(0, Number(e.target.value)))}
                className="w-full min-h-11 border border-slate-300 rounded-xl px-3 text-slate-900 font-bold focus:outline-none focus:border-slate-900"
              />
              <span className="text-[11px] text-slate-500 block mt-1">
                🛡️ Khi thua ở 0 LP, nếu còn giáp sẽ không bị rớt rank (giữ nguyên ở 0 LP).
              </span>
            </div>

            {/* Preview Result */}
            {(() => {
              const preview = getPlayerRankDisplay(manualLpInput, manualPlacementsInput, manualShieldInput)
              return (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Xem trước Rank:</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`font-black text-sm ${preview.textColor}`}>{preview.name}</span>
                      {manualShieldInput > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 font-bold text-[10px]">
                          🛡️ {manualShieldInput} giáp
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-slate-900">
                    <span>{manualLpInput} LP</span>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </BottomSheet>

      {/* Host Restore Deleted Members */}
      <BottomSheet
        open={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        title="Khôi phục thành viên đã xóa"
        panelClassName="sm:max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm sm:text-xs text-slate-600 leading-relaxed">
            Các tài khoản thành viên từng bị xóa. Nhấn <span className="font-bold text-emerald-700">"Khôi phục"</span> để đưa
            thành viên trở lại hoạt động với đầy đủ lịch sử, LP và phân loại.
          </p>

          {isLoadingDeleted ? (
            <div className="py-10 text-center text-xs text-slate-500 font-semibold animate-pulse">
              Đang tải danh sách thành viên đã xóa...
            </div>
          ) : deletedMembers.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 space-y-2">
              <DuckMascot size={36} rounded="xl" className="mx-auto opacity-50" />
              <p className="font-bold text-slate-700">Không có thành viên nào bị xóa gần đây!</p>
              <p className="text-[11px] text-slate-400">Dữ liệu toàn bộ thành viên đều đang an toàn và đầy đủ.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {deletedMembers.map((dm) => {
                const restoring = restoreMemberMutation.isPending && restoreMemberMutation.variables === dm.id
                return (
                  <li key={dm.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={dm.avatarUrl || '/duck-mascot.png'}
                        alt={dm.fullName}
                        className="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 text-sm sm:text-xs truncate">{dm.fullName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {dm.phone || 'Không có SĐT'} • {dm.membershipType === 'FIXED' ? 'Cố định' : 'Vãng lai'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => restoreMemberMutation.mutate(dm.id)}
                      disabled={restoring}
                      className="min-h-11 sm:min-h-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-[11px] font-bold rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1 shrink-0 disabled:opacity-60"
                    >
                      <RotateCcw size={12} />
                      <span>{restoring ? 'Đang...' : 'Khôi phục'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </BottomSheet>

      {/* Xác nhận xóa thành viên */}
      <ConfirmSheet
        open={!!confirmDeleteMember}
        onClose={() => setConfirmDeleteMember(null)}
        title="Xác nhận xóa thành viên"
        confirmLabel="Đồng ý xóa"
        pendingLabel="Đang xóa..."
        cancelLabel="Hủy bỏ"
        destructive
        pending={deleteMemberMutation.isPending}
        onConfirm={() => {
          if (!confirmDeleteMember) return
          deleteMemberMutation.mutate(confirmDeleteMember.id, {
            onSettled: () => setConfirmDeleteMember(null),
          })
        }}
      >
        {confirmDeleteMember && (
          <>
            <p>
              Xóa tài khoản của <b className="text-slate-900">"{confirmDeleteMember.fullName}"</b> (
              {confirmDeleteMember.phone || 'Không có SĐT'})?
            </p>
            <p className="text-xs text-emerald-700 font-medium bg-emerald-50 p-2 rounded-xl border border-emerald-200">
              💡 Dữ liệu không bị mất. Có thể khôi phục bất kỳ lúc nào qua nút "Khôi phục thành viên".
            </p>
          </>
        )}
      </ConfirmSheet>

      {/* Xác nhận đặt lại mật khẩu */}
      <ConfirmSheet
        open={!!confirmResetPassMember}
        onClose={() => setConfirmResetPassMember(null)}
        title="Đặt lại mật khẩu"
        confirmLabel="Đặt lại"
        pendingLabel="Đang cấp..."
        pending={resetPasswordMutation.isPending}
        onConfirm={() => {
          if (!confirmResetPassMember) return
          resetPasswordMutation.mutate(confirmResetPassMember.id, {
            onSettled: () => setConfirmResetPassMember(null),
          })
        }}
      >
        {confirmResetPassMember && (
          <p>
            Đặt lại mật khẩu của <b className="text-slate-900">{confirmResetPassMember.fullName}</b> về mặc định{' '}
            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-amber-800 font-bold">123456</code> và thông báo về
            Telegram?
          </p>
        )}
      </ConfirmSheet>

      {/* Xác nhận chuyển về Vãng Lai */}
      <ConfirmSheet
        open={!!confirmDowngradeMember}
        onClose={() => setConfirmDowngradeMember(null)}
        title="Chuyển về Vãng Lai"
        confirmLabel="Xác nhận"
        pendingLabel="Đang lưu..."
        pending={updateTypeMutation.isPending}
        onConfirm={() => {
          if (!confirmDowngradeMember) return
          updateTypeMutation.mutate(
            { userId: confirmDowngradeMember.id, type: 'CASUAL' },
            { onSettled: () => setConfirmDowngradeMember(null) }
          )
        }}
      >
        {confirmDowngradeMember && (
          <p>
            Chuyển <b className="text-slate-900">{confirmDowngradeMember.fullName}</b> từ Cố Định về{' '}
            <b className="text-amber-700">Khách Vãng Lai</b>?
          </p>
        )}
      </ConfirmSheet>

      {/* Host: Sửa giới tính thành viên */}
      {editingGenderMember && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
          onClick={() => !updateGenderMutation.isPending && setEditingGenderMember(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-gender-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl sm:rounded-3xl px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-7 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="sm:hidden mx-auto -mt-1 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            <div className="text-center space-y-1">
              <h3 id="edit-gender-title" className="font-black text-slate-900 text-base">
                Sửa giới tính
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                <b className="text-slate-900">{editingGenderMember.fullName}</b> hiện là{' '}
                <b className={editingGenderMember.gender === 'FEMALE' ? 'text-rose-700' : 'text-blue-700'}>
                  {editingGenderMember.gender === 'FEMALE' ? 'Nữ' : 'Nam'}
                </b>
                . Chọn giới tính đúng:
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(['MALE', 'FEMALE'] as const).map((g) => {
                const isCurrent = (editingGenderMember.gender === 'FEMALE' ? 'FEMALE' : 'MALE') === g
                return (
                  <button
                    key={g}
                    type="button"
                    disabled={isCurrent || updateGenderMutation.isPending}
                    onClick={() => updateGenderMutation.mutate({ userId: editingGenderMember.id, gender: g })}
                    className={`min-h-12 rounded-2xl border text-sm font-black transition active:scale-95 disabled:active:scale-100 disabled:cursor-not-allowed ${
                      isCurrent
                        ? 'bg-slate-100 border-slate-200 text-slate-400'
                        : g === 'FEMALE'
                        ? 'bg-rose-600 border-rose-600 text-white hover:bg-rose-700 shadow-md'
                        : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 shadow-md'
                    }`}
                  >
                    {updateGenderMutation.isPending && !isCurrent
                      ? 'Đang lưu...'
                      : `${g === 'FEMALE' ? 'Nữ' : 'Nam'}${isCurrent ? ' (hiện tại)' : ''}`}
                  </button>
                )
              })}
            </div>

            <p className="text-[11px] text-amber-800 font-medium bg-amber-50 p-2.5 rounded-xl border border-amber-200 leading-relaxed">
              💡 Các ca đã đăng ký nhưng <b>chưa thanh toán</b> sẽ được tính lại giá theo giới tính mới. Ca đã thanh toán giữ nguyên để đối soát.
            </p>

            <button
              type="button"
              onClick={() => setEditingGenderMember(null)}
              disabled={updateGenderMutation.isPending}
              className="w-full min-h-11 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm sm:text-xs rounded-xl transition"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Xác nhận nâng cấp Cố Định */}
      <ConfirmSheet
        open={!!confirmUpgradeMember}
        onClose={() => setConfirmUpgradeMember(null)}
        title="Nâng cấp Cố Định"
        confirmLabel="Đồng ý"
        pendingLabel="Đang lưu..."
        pending={updateTypeMutation.isPending}
        onConfirm={() => {
          if (!confirmUpgradeMember) return
          updateTypeMutation.mutate(
            { userId: confirmUpgradeMember.id, type: 'FIXED' },
            { onSettled: () => setConfirmUpgradeMember(null) }
          )
        }}
      >
        {confirmUpgradeMember && (
          <p>
            Nâng cấp <b className="text-slate-900">{confirmUpgradeMember.fullName}</b> lên{' '}
            <b className="text-emerald-700">Thành Viên Cố Định</b> chính thức của CLB?
          </p>
        )}
      </ConfirmSheet>

      {/* Xác nhận tối ưu ảnh đại diện (thay window.confirm) */}
      <ConfirmSheet
        open={!!optimizePreview}
        onClose={() => setOptimizePreview(null)}
        title="Thu nhỏ ảnh đại diện"
        confirmLabel="Tiếp tục thu nhỏ"
        pendingLabel="Đang xử lý..."
        destructive
        pending={optimizeAvatarsMutation.isPending}
        onConfirm={handleApplyOptimizeAvatars}
      >
        {optimizePreview && (
          <>
            <p>
              Sẽ thu nhỏ <b>{optimizePreview.changed}</b> ảnh đại diện ({optimizePreview.beforeKb} KB → {optimizePreview.afterKb}{' '}
              KB, tiết kiệm khoảng {optimizePreview.savedKb} KB mỗi lần tải danh sách).
            </p>
            <p className="text-xs text-rose-700 font-bold">Thao tác này ghi đè ảnh cũ và không thể hoàn tác.</p>
          </>
        )}
      </ConfirmSheet>
    </div>
  )
}
