import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { MemberProfile } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
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
} from 'lucide-react'

export const MemberListView: React.FC = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'FIXED' | 'PENDING' | 'CASUAL'>('FIXED')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: members = [], isLoading } = useQuery<MemberProfile[]>({
    queryKey: ['members'],
    queryFn: async () => {
      const res = await api.get('/members')
      return res.data
    },
    refetchInterval: 8000,
  })

  // Mutations for Host
  const approveMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.post(`/members/${userId}/approve-fixed`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      alert('Đã duyệt thành viên Cố Định thành công!')
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Không thể duyệt thành viên!')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.post(`/members/${userId}/reject-fixed`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      alert('Đã từ chối / chuyển thành viên về trạng thái Vãng Lai!')
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Có lỗi xảy ra!')
    },
  })

  const updateTypeMutation = useMutation({
    mutationFn: async ({ userId, type }: { userId: number; type: string }) => {
      const res = await api.put(`/members/${userId}/membership-type`, { membershipType: type })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Không thể đổi phân loại!')
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.post(`/members/${userId}/reset-password`)
      return res.data
    },
    onSuccess: (data) => {
      alert(data.message || 'Đã đặt lại mật khẩu về 123456 thành công!')
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Không thể đặt lại mật khẩu!')
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

  const filteredList = currentList.filter(
    (m) =>
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone.includes(searchQuery)
  )

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
              Quản lý danh sách thành viên Cố Định & Vãng Lai • Chống bịp bợm giá vé và gian lận quyền lợi CLB.
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
            <span className="text-xl font-black text-amber-950 mt-0.5 block">{pendingMembers.length} đơn</span>
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
                  <th className="py-3 px-3">Họ và tên / SĐT</th>
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
                          <span className="text-[11px] text-slate-500">{m.phone}</span>
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
                        {m.winCount}W - {m.lossCount}L
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold">{m.winRate}% Thắng</span>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1 font-mono font-bold text-slate-900">
                        <Award size={14} className="text-amber-500" />
                        <span>{m.eloScore || 0} ELO</span>
                      </div>
                    </td>

                    {/* Host Controls */}
                    {user?.role === 'HOST' && (
                      <td className="py-3.5 px-3 text-right">
                        {m.role === 'HOST' ? (
                          <span className="text-[10px] text-slate-400 font-bold italic">Host Mặc định</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Nút Host Reset Mật khẩu nhanh */}
                            <button
                              onClick={() => {
                                if (window.confirm(`Đặt lại mật khẩu của ${m.fullName} về mặc định 123456 và gửi báo về Telegram?`)) {
                                  resetPasswordMutation.mutate(m.id)
                                }
                              }}
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
                                onClick={() => {
                                  if (window.confirm(`Bạn có chắc muốn chuyển ${m.fullName} về trạng thái Vãng Lai?`)) {
                                    updateTypeMutation.mutate({ userId: m.id, type: 'CASUAL' })
                                  }
                                }}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-[11px] rounded-xl border border-slate-200 transition"
                                title="Hạ cấp về Khách Vãng Lai"
                              >
                                <span>Chuyển về Vãng Lai</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Nâng cấp trực tiếp ${m.fullName} lên Thành Viên Cố Định?`)) {
                                    updateTypeMutation.mutate({ userId: m.id, type: 'FIXED' })
                                  }
                                }}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1"
                                title="Level Up lên Thành Viên Cố Định"
                              >
                                <Sparkles size={12} className="text-amber-300" />
                                <span>Level Up Cố Định</span>
                              </button>
                            )}
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
    </div>
  )
}
