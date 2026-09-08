import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { SessionItem } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
import {
  Clock,
  MapPin,
  Users,
  ChevronRight,
  Plus,
  ShieldCheck,
  Trophy,
  Activity,
  Zap,
  Award,
  Sparkles,
  Flame,
  Settings,
  X,
  Layers,
  Gift,
  Coins,
  Swords,
} from 'lucide-react'

export const SessionListView: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  // State modal chỉnh sửa nhanh ca đánh (dành cho Host)
  const [editingSession, setEditingSession] = useState<SessionItem | null>(null)
  const [editForm, setEditForm] = useState({
    courtNames: '',
    maxSlots: 8,
    title: '',
  })

  const { data: sessions, isLoading, error } = useQuery<SessionItem[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await api.get('/sessions')
      return res.data
    },
  })

  // Mutation cập nhật sân & slot trực tiếp
  const updateSessionMutation = useMutation({
    mutationFn: async ({
      sessionId,
      courtNames,
      maxSlots,
      title,
    }: {
      sessionId: number
      courtNames: string
      maxSlots: number
      title: string
    }) => {
      const res = await api.put(`/sessions/${sessionId}`, {
        title,
        courtNames,
        maxSlots,
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setEditingSession(null)
      alert('Đã cập nhật sân và số slot thành công!')
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Không thể cập nhật ca đánh!')
    },
  })

  const handleOpenEditModal = (e: React.MouseEvent, session: SessionItem) => {
    e.stopPropagation()
    setEditingSession(session)
    setEditForm({
      courtNames: session.courtNames || 'Sân 1, Sân 2',
      maxSlots: session.maxSlots || 8,
      title: session.title,
    })
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSession) return
    if (!editForm.courtNames.trim()) {
      alert('Vui lòng nhập tên sân!')
      return
    }
    if (editForm.maxSlots < editingSession.bookedSlots) {
      alert(`Số slot không được nhỏ hơn số người đã đăng ký (${editingSession.bookedSlots} người)!`)
      return
    }

    updateSessionMutation.mutate({
      sessionId: editingSession.id,
      courtNames: editForm.courtNames,
      maxSlots: Number(editForm.maxSlots),
      title: editForm.title || editingSession.title,
    })
  }

  const getEffectiveStatus = (session: SessionItem) => {
    const now = new Date().getTime()
    const start = new Date(session.startTime).getTime()
    const end = new Date(session.endTime).getTime()

    if (session.status === 'CANCELLED') return 'CANCELLED'
    if (now > end) return 'COMPLETED'
    if (now >= start && now <= end) return 'ACTIVE'
    return 'UPCOMING'
  }

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const day = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    return { day, time }
  }

  return (
    <div className="space-y-10">
      {/* 1. Ultra High-End Editorial Sports Hero Section */}
      <div className="saas-card rounded-3xl p-8 sm:p-10 md:p-12 relative overflow-hidden border border-slate-300/80 shadow-2xl shadow-slate-900/[0.06]">
        {/* Subtle decorative athletic stripes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-rose-500/[0.06] via-indigo-500/[0.04] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 relative z-10">
          <div className="space-y-6 max-w-2xl">
            {/* Pill Tag with Live Indicator */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-950 text-white text-xs font-bold shadow-md">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="tracking-wide">CLB Cầu Lông Làng Địa Ngục</span>
              <span className="text-slate-500">•</span>
              <span className="text-rose-400 font-semibold">Pro Match System</span>
            </div>

            {/* Editorial Sharp Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-950 leading-[1.08]">
              Quản trị ca đấu & <br />
              <span className="bg-gradient-to-r from-slate-950 via-rose-700 to-slate-950 bg-clip-text text-transparent underline decoration-rose-600/40 decoration-4 underline-offset-8">
                điểm danh thông minh
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
              Hệ sinh thái cầu lông thông minh: Tích điểm chuyên cần đổi nước & voucher, bảng vàng leo rank Thách Đấu, ghép sân cân bằng trình độ và minh bạch chi phí từng ca.
            </p>

            {/* CTA Buttons & User Welcome */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              {user?.role === 'HOST' ? (
                <button
                  onClick={() => navigate('/host/create-session')}
                  className="px-6 py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xl shadow-slate-950/20 flex items-center gap-2.5 transition active:scale-95"
                >
                  <Plus size={16} />
                  <span>Tạo ca đánh mới</span>
                </button>
              ) : !user ? (
                <button
                  onClick={() => navigate('/login')}
                  className="px-6 py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xl shadow-slate-950/20 flex items-center gap-2.5 transition active:scale-95"
                >
                  <span>Đăng nhập thành viên</span>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <div className="inline-flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white border border-slate-300 shadow-sm text-xs font-bold text-slate-800">
                  <Flame size={15} className="text-rose-600" />
                  <span>Chào bạn,</span>
                  <b className="text-slate-950 font-black">{user.fullName}</b>
                  <span className="text-rose-600 font-extrabold">({user.sessionsAttended} buổi)</span>
                </div>
              )}

              <button
                onClick={() => navigate('/leaderboard')}
                className="px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs rounded-xl border border-slate-300 shadow-sm transition flex items-center gap-2 active:scale-95"
              >
                <Trophy size={16} className="text-amber-500" />
                <span>Bảng vinh danh CLB</span>
              </button>
            </div>
          </div>

          {/* Right Spotlight Mascot Frame */}
          <div className="flex flex-col items-center justify-center">
            <div className="p-6 rounded-3xl bg-white border border-slate-300/90 shadow-2xl shadow-slate-900/10 flex flex-col items-center gap-4 relative group">
              <div className="absolute -top-3 -right-3 px-3 py-1 bg-rose-600 text-white text-[10px] font-black uppercase rounded-full tracking-wider shadow-md">
                Official Mascot
              </div>
              <DuckMascot size={180} rounded="2xl" />
              <div className="text-center">
                <span className="text-xs font-black text-slate-950 block tracking-tight">
                  Smash Champion Duck
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">
                  CLB Cầu Lông Làng Địa Ngục
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Grid Highlights - Member Benefits */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10 pt-8 border-t border-slate-200 text-xs">
          <div
            onClick={() => navigate('/loyalty')}
            className="p-4.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1 cursor-pointer hover:border-rose-300 hover:shadow-md transition group"
          >
            <div className="flex items-center gap-2 text-slate-600 font-bold group-hover:text-rose-600 transition">
              <Gift size={16} className="text-rose-500" />
              <span>Tích điểm chuyên cần</span>
            </div>
            <span className="text-lg sm:text-xl font-black text-slate-950 block mt-1 tracking-tight">
              Đổi Nước & Voucher
            </span>
          </div>

          <div
            onClick={() => navigate('/leaderboard')}
            className="p-4.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1 cursor-pointer hover:border-amber-300 hover:shadow-md transition group"
          >
            <div className="flex items-center gap-2 text-slate-600 font-bold group-hover:text-amber-600 transition">
              <Trophy size={16} className="text-amber-500" />
              <span>Leo Rank & Vinh danh</span>
            </div>
            <span className="text-lg sm:text-xl font-black text-slate-950 block mt-1 tracking-tight">
              Thách Đấu & Thần Kiếm
            </span>
          </div>

          <div className="p-4.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1">
            <div className="flex items-center gap-2 text-slate-600 font-bold">
              <Swords size={16} className="text-indigo-500" />
              <span>Ghép sân thông minh</span>
            </div>
            <span className="text-lg sm:text-xl font-black text-slate-950 block mt-1 tracking-tight">
              Cân bằng trình độ 100%
            </span>
          </div>

          <div className="p-4.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1">
            <div className="flex items-center gap-2 text-slate-600 font-bold">
              <Coins size={16} className="text-emerald-600" />
              <span>Chia tiền tự động</span>
            </div>
            <span className="text-lg sm:text-xl font-black text-slate-950 block mt-1 tracking-tight">
              Chi phí rõ ràng từng ca
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Sessions Grid Feed */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950 flex items-center gap-2.5 tracking-tight">
              <Sparkles size={22} className="text-rose-600" />
              <span>Danh sách các ca cầu lông</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-semibold">
              Đăng ký slot, điểm danh QR GPS và bắt kèo trực tiếp trên hệ thống
            </p>
          </div>
          <span className="text-xs text-slate-600 font-bold hidden sm:flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Cập nhật thời gian thực</span>
          </span>
        </div>

        {isLoading ? (
          <div className="text-center py-24 text-slate-600 text-sm animate-pulse space-y-3">
            <DuckMascot size={56} rounded="2xl" className="mx-auto" />
            <p className="font-bold text-slate-900">Đang tải dữ liệu ca đánh...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-bold">
            Không thể kết nối máy chủ backend. Vui lòng kiểm tra lại.
          </div>
        ) : sessions?.length === 0 ? (
          <div className="text-center py-20 saas-card rounded-2xl space-y-3 border border-slate-200">
            <DuckMascot size={64} rounded="2xl" className="mx-auto opacity-70" />
            <p className="text-slate-950 font-black text-lg">Hiện chưa có ca đánh nào được mở</p>
            <p className="text-slate-500 text-xs font-semibold">Vui lòng quay lại sau hoặc liên hệ Host anhduck.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions?.map((session) => {
              const start = formatDateTime(session.startTime)
              const end = formatDateTime(session.endTime)
              const isFull = session.bookedSlots >= session.maxSlots
              const effectiveStatus = getEffectiveStatus(session)

              return (
                <div
                  key={session.id}
                  onClick={() => navigate(`/sessions/${session.id}`)}
                  className="saas-card-interactive rounded-2xl p-6 cursor-pointer flex flex-col justify-between group relative border border-slate-300 shadow-lg shadow-slate-900/[0.04]"
                >
                  <div className="space-y-4">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                            effectiveStatus === 'ACTIVE'
                              ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-sm animate-pulse'
                              : effectiveStatus === 'UPCOMING'
                              ? 'bg-slate-950 text-white border-slate-950 shadow-sm'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {effectiveStatus === 'ACTIVE'
                            ? '• Đang diễn ra'
                            : effectiveStatus === 'UPCOMING'
                            ? 'Sắp diễn ra'
                            : 'Đã kết thúc'}
                        </span>

                        {session.courtNames && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-300">
                            🏸 {session.courtNames}
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-xs font-black px-3 py-1 rounded-lg border ${
                          isFull
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {session.bookedSlots}/{session.maxSlots} Slots {isFull && '(Đầy)'}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-black text-lg text-slate-950 group-hover:text-rose-700 transition leading-snug">
                      {session.title}
                    </h3>

                    {/* Venue & Location Details Box */}
                    <div className="space-y-2 text-xs text-slate-700 bg-slate-50/90 p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <MapPin size={15} className="text-slate-950 shrink-0" />
                        <span className="truncate font-bold text-slate-950">{session.venueName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={15} className="text-slate-500 shrink-0" />
                        <span className="text-slate-800 font-semibold">
                          {start.day}, {start.time} - {end.time}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 text-[11px] font-medium pt-0.5">
                        <Users size={14} className="text-slate-500 shrink-0" />
                        <span>Host: <b className="text-slate-950 font-bold">{session.hostName}</b></span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Matrix Bottom Bar */}
                  <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-bold">Slot Nam / Nữ (Trợ giá):</span>
                        {session.startTime && session.endTime && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {Math.round(((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60)) * 10) / 10}h
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-black text-slate-950 text-sm">
                          {Number(session.memberMalePrice).toLocaleString('vi-VN')}đ
                        </span>
                        <span className="text-slate-300 font-bold">/</span>
                        <span className="font-black text-rose-600 text-sm">
                          {Number(session.memberFemalePrice).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {user?.role === 'HOST' && (
                        <button
                          onClick={(e) => handleOpenEditModal(e, session)}
                          className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border border-slate-300 rounded-lg shadow-xs transition flex items-center gap-1 text-[11px] font-bold z-10"
                          title="Sửa nhanh sân & slot ca đánh này"
                        >
                          <Settings size={13} className="text-slate-600" />
                          <span>Sửa ca</span>
                        </button>
                      )}

                      <div className="flex items-center gap-1 text-slate-950 font-black text-xs group-hover:translate-x-1 transition bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        <span>Vào ca</span>
                        <ChevronRight size={15} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* QUICK EDIT MODAL FOR HOST */}
      {editingSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setEditingSession(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-6 relative"
          >
            <button
              onClick={() => setEditingSession(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
            >
              <X size={18} />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold">
                <Layers size={13} className="text-slate-900" />
                <span>Host Fast Editor</span>
              </div>
              <h3 className="text-xl font-black text-slate-950">Chỉnh sửa sân & Quân số ca đánh</h3>
              <p className="text-xs text-slate-500 font-medium">
                Cập nhật nhanh danh sách sân và nâng giới hạn slot người tham gia
              </p>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Tiêu đề ca đánh</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Ví dụ: Giao lưu cầu lông tối..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 focus:bg-white focus:border-slate-950 focus:outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Danh sách sân (Phân tách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  value={editForm.courtNames}
                  onChange={(e) => setEditForm({ ...editForm, courtNames: e.target.value })}
                  placeholder="Ví dụ: Sân 1, Sân 2, Sân 3"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 focus:bg-white focus:border-slate-950 focus:outline-none transition"
                  required
                />
                <span className="text-[10px] text-slate-500 font-medium block">
                  Mỗi sân tương ứng ~4-8 người chơi. Ví dụ 3 sân thì nhập: <code>Sân 1, Sân 2, Sân 3</code>
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Tổng số slot tối đa (Max Slots)</span>
                  <span className="text-slate-500 text-[11px]">Hiện có: <b>{editingSession.bookedSlots} người</b></span>
                </label>
                <input
                  type="number"
                  min={editingSession.bookedSlots || 1}
                  max={60}
                  value={editForm.maxSlots}
                  onChange={(e) => setEditForm({ ...editForm, maxSlots: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 focus:bg-white focus:border-slate-950 focus:outline-none transition"
                  required
                />
                <span className="text-[10px] text-slate-500 font-medium block">
                  Có thể nâng từ 8 lên 12, 14, 16 slots khi mở thêm sân mới để nhận thêm người đăng ký.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={updateSessionMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-black shadow-lg shadow-slate-950/20 transition active:scale-95 disabled:opacity-50"
                >
                  {updateSessionMutation.isPending ? 'Đang lưu...' : 'Lưu cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
