import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { MemberProfile } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
import { useToast } from '../components/ToastProvider'
import { getPlayerRankDisplay, LOL_RANKS } from '../lib/ranks'
import {
  Users,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Search,
  Sparkles,
  Flame,
  Award,
  KeyRound,
  Edit2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'

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

  const { data: members = [], isLoading } = useQuery<MemberProfile[]>({
    queryKey: ['members'],
    queryFn: async () => {
      const res = await api.get('/members')
      return res.data
    },
    refetchInterval: 8000,
  })

  const { data: deletedMembers = [], isLoading: isLoadingDeleted, refetch: refetchDeleted } = useQuery<MemberProfile[]>({
    queryKey: ['deleted-members'],
    queryFn: async () => {
      const res = await api.get('/members/deleted')
      return res.data
    },
    enabled: user?.role === 'HOST',
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
      queryClient.invalidateQueries({ queryKey: ['leaderboard-wins'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard-sessions'] })
      showToast(`Đã khôi phục thành công tài khoản của ${data.fullName}!`, 'success')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể khôi phục thành viên!', 'error')
    },
  })

  // Mutations for Host
  const approveMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.post(`/members/${userId}/approve-fixed`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      showToast('Đã duyệt thành viên Cố Định thành công!')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể duyệt thành viên!', 'error')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.post(`/members/${userId}/reject-fixed`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      showToast('Đã từ chối / chuyển thành viên về trạng thái Vãng Lai!', 'info')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Có lỗi xảy ra!', 'error')
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
      queryClient.invalidateQueries({ queryKey: ['leaderboard-wins'] })
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
      queryClient.invalidateQueries({ queryKey: ['leaderboard-wins'] })
      setEditingRankMember(null)
      showToast('Đã cập nhật Bậc Rank & LP cho thành viên thành công!')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể cập nhật Rank!', 'error')
    },
  })

  // Host Clear Database Mutation
  const resetDbMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/members/reset-database-clean')
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard-wins'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard-sessions'] })
      showToast(data?.message || 'Đã dọn sạch ca sân, bảo lưu toàn bộ thành viên thật!')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể dọn dẹp database!', 'error')
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
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold uppercase tracking-wider">
              <Users size={14} className="text-slate-900" />
              <span>SmashFlow Directory</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Danh Sách Thành Viên Làng Địa Ngục
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Quản lý danh sách thành viên Cố Định & Vãng Lai • Chống bịp bợm giá slot và gian lận quyền lợi CLB.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <DuckMascot size={56} rounded="2xl" className="shadow-md border border-slate-200" />
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 pt-6 mt-6 border-t border-slate-200/80 text-xs">
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
            <span className="text-[11px] font-bold text-emerald-800 block">🟢 Thành viên Cố định</span>
            <span className="text-xl font-black text-emerald-950 mt-0.5 block">{fixedMembers.length} người</span>
          </div>

          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl">
            <span className="text-[11px] font-bold text-amber-800 block">⏳ Đang chờ duyệt</span>
            <span className="text-xl font-black text-amber-950 mt-0.5 block">{pendingMembers.length} người</span>
          </div>

          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl">
            <span className="text-[11px] font-bold text-blue-800 block">🟡 Khách vãng lai</span>
            <span className="text-xl font-black text-blue-950 mt-0.5 block">{casualMembers.length} người</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
          <button
            onClick={() => setActiveTab('FIXED')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
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

          <button
            onClick={() => setActiveTab('PENDING')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
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

          <button
            onClick={() => setActiveTab('CASUAL')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
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
        <div className="relative min-w-[240px]">
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
          <div className="overflow-x-auto">
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
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          m.gender === 'FEMALE'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {m.gender === 'FEMALE' ? 'Nữ (Trợ giá)' : 'Nam'}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      {m.role === 'HOST' ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-900 text-white shadow-2xs">
                          Quản trị viên
                        </span>
                      ) : m.membershipType === 'FIXED' ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          <span>Cố định (Chính thức)</span>
                        </span>
                      ) : m.membershipType === 'PENDING_FIXED' ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1 w-fit animate-pulse">
                          <Clock size={12} className="text-amber-600" />
                          <span>Chờ Host duyệt</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 w-fit">
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
                              onClick={() => {
                                setEditingRankMember(m)
                                setManualLpInput(m.eloScore || 0)
                                setManualPlacementsInput(m.placementMatches ?? 5)
                                setManualShieldInput(m.shieldMatches ?? 0)
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 rounded-xl transition border border-slate-200"
                              title="Chỉnh sửa Bậc Rank / LP trực tiếp cho Host"
                            >
                              <Award size={13} className="text-amber-600" />
                            </button>
                            <button
                              onClick={() => {
                                refetchDeleted()
                                setShowRestoreModal(true)
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-bold transition active:scale-95 flex items-center gap-1"
                              title="Xem danh sách và khôi phục các thành viên đã lỡ xóa"
                            >
                              <RotateCcw size={11} />
                              <span>Khôi phục thành viên</span>
                              {deletedMembers.length > 0 && (
                                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9px]">
                                  {deletedMembers.length}
                                </span>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Nút Host Chỉnh Sửa Rank trực tiếp */}
                            <button
                              onClick={() => {
                                setEditingRankMember(m)
                                setManualLpInput(m.eloScore || 0)
                                setManualPlacementsInput(m.placementMatches ?? 5)
                                setManualShieldInput(m.shieldMatches ?? 0)
                              }}
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
                                  disabled={approveMutation.isPending}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl flex items-center gap-1 shadow-sm active:scale-95 transition"
                                  title="Duyệt người này làm Thành Viên Cố Định"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Duyệt Cố Định</span>
                                </button>

                                <button
                                  onClick={() => rejectMutation.mutate(m.id)}
                                  disabled={rejectMutation.isPending}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-xl flex items-center gap-1 transition"
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

                            {/* Nút Xóa Thành Viên */}
                            <button
                              onClick={() => setConfirmDeleteMember(m)}
                              disabled={deleteMemberMutation.isPending}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 rounded-xl transition border border-rose-200 shadow-2xs"
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
        )}
      </div>
      {/* Host Manual Rank Editor Modal */}
      {editingRankMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Award size={18} className="text-amber-500" />
                <h3 className="font-black text-slate-900 text-sm">
                  Chỉnh Rank & LP: {editingRankMember.fullName}
                </h3>
              </div>
              <button
                onClick={() => setEditingRankMember(null)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Điểm LP Tích Lũy Tổng (Total LP):
                </label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={manualLpInput}
                  onChange={(e) => setManualLpInput(Math.max(0, Number(e.target.value)))}
                  className="w-full border border-slate-300 rounded-xl p-3 text-slate-900 font-mono font-bold text-base focus:outline-none focus:border-slate-900"
                />
              </div>

              {/* Quick LP Tier Select Buttons for Host Convenience */}
              <div>
                <label className="block text-slate-500 font-bold text-[11px] mb-1.5">
                  Gợi ý chọn mốc Rank nhanh:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {LOL_RANKS.map((r) => (
                    <button
                      key={r.tier}
                      type="button"
                      onClick={() => setManualLpInput(r.minScore)}
                      className={`px-2 py-1.5 rounded-lg border text-[10px] font-black transition ${
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
                <label className="block text-slate-700 font-bold mb-1.5">
                  Trạng thái trận Phân Hạng (0..5 trận):
                </label>
                <select
                  value={manualPlacementsInput}
                  onChange={(e) => setManualPlacementsInput(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none focus:border-slate-900"
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
                <label className="block text-slate-700 font-bold mb-1.5">
                  Số trận Giáp Bảo Vệ Rank (Demotion Shield):
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={manualShieldInput}
                  onChange={(e) => setManualShieldInput(Math.max(0, Number(e.target.value)))}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none focus:border-slate-900"
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
                        <span className={`font-black text-sm ${preview.textColor}`}>
                          {preview.name}
                        </span>
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

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setEditingRankMember(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                disabled={updateRankMutation.isPending}
                onClick={() => {
                  updateRankMutation.mutate({
                    userId: editingRankMember.id,
                    eloScore: manualLpInput,
                    placementMatches: manualPlacementsInput,
                    shieldMatches: manualShieldInput,
                  })
                }}
                className="px-5 py-2 text-xs font-black bg-slate-950 hover:bg-slate-800 text-white rounded-xl shadow active:scale-95 transition"
              >
                {updateRankMutation.isPending ? 'Đang lưu...' : 'Lưu Bậc Rank'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Host Restore Deleted Members Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <RotateCcw size={18} className="text-emerald-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  Khôi Phục Thành Viên Đã Xóa
                </h3>
              </div>
              <button
                onClick={() => setShowRestoreModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Dưới đây là các tài khoản thành viên thật từng bị xóa. Bạn có thể nhấn <span className="font-bold text-emerald-700">"Khôi phục"</span> để đưa thành viên trở lại hoạt động bình thường với đầy đủ lịch sử, LP và phân loại.
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
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 pr-1 space-y-1">
                {deletedMembers.map((dm) => (
                  <div key={dm.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={dm.avatarUrl || '/duck-mascot.png'}
                        alt={dm.fullName}
                        className="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 text-xs truncate">{dm.fullName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{dm.phone || 'Không có SĐT'} • {dm.membershipType === 'FIXED' ? 'Cố định' : 'Vãng lai'}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => restoreMemberMutation.mutate(dm.id)}
                      disabled={restoreMemberMutation.isPending}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1 shrink-0"
                    >
                      <RotateCcw size={12} />
                      <span>{restoreMemberMutation.isPending ? 'Đang...' : 'Khôi phục'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Center Modal: Confirm Delete Member */}
      {confirmDeleteMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto shadow-sm">
              <Trash2 size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-base">Xác nhận xóa thành viên</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa tài khoản của <b className="text-slate-900 font-bold">"{confirmDeleteMember.fullName}"</b> ({confirmDeleteMember.phone || 'Không có SĐT'})?
              </p>
              <p className="text-[11px] text-emerald-700 font-medium bg-emerald-50 p-2 rounded-xl border border-emerald-200 mt-2">
                💡 Dữ liệu không bị mất. Bạn có thể khôi phục lại bất kỳ lúc nào qua nút "Khôi phục thành viên"!
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteMember(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                disabled={deleteMemberMutation.isPending}
                onClick={() => {
                  deleteMemberMutation.mutate(confirmDeleteMember.id, {
                    onSettled: () => setConfirmDeleteMember(null),
                  })
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 disabled:opacity-50"
              >
                {deleteMemberMutation.isPending ? 'Đang xóa...' : 'Đồng ý xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Center Modal: Confirm Reset Password */}
      {confirmResetPassMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto shadow-sm">
              <KeyRound size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-base">Đặt lại mật khẩu</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Đặt lại mật khẩu của <b className="text-slate-900 font-bold">{confirmResetPassMember.fullName}</b> về mặc định <code className="px-1.5 py-0.5 bg-slate-100 rounded text-amber-800 font-bold">123456</code> và thông báo về Telegram?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setConfirmResetPassMember(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Hủy
              </button>
              <button
                disabled={resetPasswordMutation.isPending}
                onClick={() => {
                  resetPasswordMutation.mutate(confirmResetPassMember.id, {
                    onSettled: () => setConfirmResetPassMember(null),
                  })
                }}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 disabled:opacity-50"
              >
                {resetPasswordMutation.isPending ? 'Đang cấp...' : 'Đặt lại'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Center Modal: Confirm Downgrade to Casual */}
      {confirmDowngradeMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-base">Chuyển về Vãng Lai</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn chuyển <b className="text-slate-900 font-bold">{confirmDowngradeMember.fullName}</b> từ Cố Định về <b className="text-amber-700 font-bold">Khách Vãng Lai</b>?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setConfirmDowngradeMember(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Hủy
              </button>
              <button
                disabled={updateTypeMutation.isPending}
                onClick={() => {
                  updateTypeMutation.mutate(
                    { userId: confirmDowngradeMember.id, type: 'CASUAL' },
                    { onSettled: () => setConfirmDowngradeMember(null) }
                  )
                }}
                className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Center Modal: Confirm Upgrade to Fixed */}
      {confirmUpgradeMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
              <Sparkles size={24} className="text-amber-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-base">Nâng cấp Cố Định</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Nâng cấp trực tiếp thành viên <b className="text-slate-900 font-bold">{confirmUpgradeMember.fullName}</b> lên <b className="text-emerald-700 font-bold">Thành Viên Cố Định</b> chính thức của CLB?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setConfirmUpgradeMember(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Hủy
              </button>
              <button
                disabled={updateTypeMutation.isPending}
                onClick={() => {
                  updateTypeMutation.mutate(
                    { userId: confirmUpgradeMember.id, type: 'FIXED' },
                    { onSettled: () => setConfirmUpgradeMember(null) }
                  )
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
