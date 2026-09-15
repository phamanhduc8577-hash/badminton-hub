import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { SessionItem } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
import { useToast } from '../components/ToastProvider'
import { formatSessionDateTime } from '../lib/dateUtils'
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
  Filter,
  Calendar,
  History,
  CheckCircle,
} from 'lucide-react'

export const SessionListView: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { showToast } = useToast()

  // State modal chỉnh sửa nhanh ca đánh (dành cho Host)
  const [editingSession, setEditingSession] = useState<SessionItem | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    courtNames: '',
    maxSlots: 8,
    startTime: '',
    endTime: '',
    venueName: '',
    venueAddress: '',
    memberMalePrice: 0,
    memberFemalePrice: 0,
    guestMalePrice: 0,
    guestFemalePrice: 0,
    memberMalePrice2h: 0,
    memberFemalePrice2h: 0,
    guestMalePrice2h: 0,
    guestFemalePrice2h: 0,
    costCourt: 0,
    costShuttlecock: 0,
    costDrinks: 0,
    depositAmount: 0,
  })

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE_UPCOMING' | 'COMPLETED'>('ALL')
  const [showAllCompleted, setShowAllCompleted] = useState(false)

  const { data: sessions, isLoading, error } = useQuery<SessionItem[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await api.get('/sessions')
      return res.data
    },
  })

  // Mutation cập nhật sân, slot, địa điểm & bảng giá trực tiếp
  const updateSessionMutation = useMutation({
    mutationFn: async ({
      sessionId,
      payload,
    }: {
      sessionId: number
      payload: any
    }) => {
      const res = await api.put(`/sessions/${sessionId}`, payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setEditingSession(null)
      showToast('Đã cập nhật thông tin ca đánh thành công!', 'success')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể cập nhật ca đánh!', 'error')
    },
  })

  const formatForDateTimeLocal = (dStr: string) => {
    if (!dStr) return ''
    const d = new Date(dStr)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const handleOpenEditModal = (e: React.MouseEvent, session: SessionItem) => {
    e.stopPropagation()
    setEditingSession(session)
    setEditForm({
      title: session.title,
      courtNames: session.courtNames || 'Sân 1, Sân 2',
      maxSlots: session.maxSlots || 8,
      startTime: formatForDateTimeLocal(session.startTime),
      endTime: formatForDateTimeLocal(session.endTime),
      venueName: session.venueName || '',
      venueAddress: session.venueAddress || '',
      memberMalePrice: session.memberMalePrice || 0,
      memberFemalePrice: session.memberFemalePrice || 0,
      guestMalePrice: session.guestMalePrice || 0,
      guestFemalePrice: session.guestFemalePrice || 0,
      memberMalePrice2h: session.memberMalePrice2h || 0,
      memberFemalePrice2h: session.memberFemalePrice2h || 0,
      guestMalePrice2h: session.guestMalePrice2h || 0,
      guestFemalePrice2h: session.guestFemalePrice2h || 0,
      costCourt: session.costCourt || 0,
      costShuttlecock: session.costShuttlecock || 0,
      costDrinks: session.costDrinks || 0,
      depositAmount: session.depositAmount || 0,
    })
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSession) return
    if (!editForm.courtNames.trim()) {
      showToast('Vui lòng nhập tên sân!', 'error')
      return
    }
    if (editForm.maxSlots < editingSession.bookedSlots) {
      showToast(`Số slot không được nhỏ hơn số người đã đăng ký (${editingSession.bookedSlots} người)!`, 'error')
      return
    }
    if (editForm.startTime && editForm.endTime) {
      const s = new Date(editForm.startTime).getTime()
      const end = new Date(editForm.endTime).getTime()
      if (end <= s) {
        showToast('Giờ kết thúc phải sau giờ bắt đầu!', 'error')
        return
      }
    }

    // Đảm bảo định dạng chuẩn ISO giây "YYYY-MM-DDTHH:mm:ss" tương thích 100% mọi API Backend
    const formatToFullIso = (val: string) => {
      if (!val) return undefined
      return val.length === 16 ? `${val}:00` : val
    }

    updateSessionMutation.mutate({
      sessionId: editingSession.id,
      payload: {
        title: editForm.title || editingSession.title,
        courtNames: editForm.courtNames,
        maxSlots: Number(editForm.maxSlots),
        startTime: formatToFullIso(editForm.startTime),
        endTime: formatToFullIso(editForm.endTime),
        venueName: editForm.venueName,
        venueAddress: editForm.venueAddress,
        memberMalePrice: Number(editForm.memberMalePrice),
        memberFemalePrice: Number(editForm.memberFemalePrice),
        guestMalePrice: Number(editForm.guestMalePrice),
        guestFemalePrice: Number(editForm.guestFemalePrice),
        memberMalePrice2h: editForm.memberMalePrice2h ? Number(editForm.memberMalePrice2h) : null,
        memberFemalePrice2h: editForm.memberFemalePrice2h ? Number(editForm.memberFemalePrice2h) : null,
        guestMalePrice2h: editForm.guestMalePrice2h ? Number(editForm.guestMalePrice2h) : null,
        guestFemalePrice2h: editForm.guestFemalePrice2h ? Number(editForm.guestFemalePrice2h) : null,
        costCourt: Number(editForm.costCourt || 0),
        costShuttlecock: Number(editForm.costShuttlecock || 0),
        costDrinks: Number(editForm.costDrinks || 0),
        depositAmount: Number(editForm.depositAmount || 0),
      },
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
    return formatSessionDateTime(dateStr)
  }

  // Phân loại & sắp xếp ca đánh tối ưu UX (Ưu tiên Sắp diễn ra/Đang diễn ra lên đầu)
  const sortedAndFilteredSessions = React.useMemo(() => {
    if (!sessions) return []

    const listWithStatus = sessions.map((s) => ({
      ...s,
      effectiveStatus: getEffectiveStatus(s),
    }))

    // Sắp xếp: ACTIVE (0) -> UPCOMING (1) -> COMPLETED (2) -> CANCELLED (3)
    // Cùng nhóm ACTIVE/UPCOMING thì ca nào bắt đầu sớm hơn xếp trước
    // Nhóm COMPLETED thì ca nào mới kết thúc nhất xếp trước
    const sorted = [...listWithStatus].sort((a, b) => {
      const orderMap: Record<string, number> = {
        ACTIVE: 0,
        UPCOMING: 1,
        COMPLETED: 2,
        CANCELLED: 3,
      }
      const orderA = orderMap[a.effectiveStatus] ?? 99
      const orderB = orderMap[b.effectiveStatus] ?? 99

      if (orderA !== orderB) return orderA - orderB

      const timeA = new Date(a.startTime).getTime()
      const timeB = new Date(b.startTime).getTime()

      if (a.effectiveStatus === 'COMPLETED' || a.effectiveStatus === 'CANCELLED') {
        return timeB - timeA // Ca mới kết thúc xếp trên
      }
      return timeA - timeB // Ca sắp tới gần nhất xếp trên
    })

    if (statusFilter === 'ACTIVE_UPCOMING') {
      return sorted.filter((s) => s.effectiveStatus === 'ACTIVE' || s.effectiveStatus === 'UPCOMING')
    }
    if (statusFilter === 'COMPLETED') {
      return sorted.filter((s) => s.effectiveStatus === 'COMPLETED' || s.effectiveStatus === 'CANCELLED')
    }

    return sorted
  }, [sessions, statusFilter])

  // Thống kê nhanh số lượng theo trạng thái
  const counts = React.useMemo(() => {
    if (!sessions) return { total: 0, activeUpcoming: 0, completed: 0 }
    let activeUpcoming = 0
    let completed = 0
    sessions.forEach((s) => {
      const st = getEffectiveStatus(s)
      if (st === 'ACTIVE' || st === 'UPCOMING') activeUpcoming++
      else completed++
    })
    return {
      total: sessions.length,
      activeUpcoming,
      completed,
    }
  }, [sessions])

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950 flex items-center gap-2.5 tracking-tight">
              <Sparkles size={22} className="text-rose-600" />
              <span>Danh sách các ca cầu lông</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-semibold">
              Đăng ký slot, điểm danh QR GPS và bắt kèo trực tiếp trên hệ thống
            </p>
          </div>

          {/* Status Filter Tabs - Mobile Responsive Pill Group */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl w-full sm:w-auto overflow-x-auto shadow-inner">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <Calendar size={13} />
              <span>Tất cả ({counts.total})</span>
            </button>

            <button
              onClick={() => setStatusFilter('ACTIVE_UPCOMING')}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                statusFilter === 'ACTIVE_UPCOMING'
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <Zap size={13} className={statusFilter === 'ACTIVE_UPCOMING' ? 'text-amber-400' : 'text-amber-600'} />
              <span>Sắp tới ({counts.activeUpcoming})</span>
            </button>

            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                statusFilter === 'COMPLETED'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <History size={13} />
              <span>Lịch sử ({counts.completed})</span>
            </button>
          </div>
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
        ) : sortedAndFilteredSessions.length === 0 ? (
          <div className="text-center py-16 saas-card rounded-3xl space-y-3 border border-slate-200">
            <DuckMascot size={64} rounded="2xl" className="mx-auto opacity-70" />
            <p className="text-slate-950 font-black text-lg">
              {statusFilter === 'ACTIVE_UPCOMING'
                ? 'Không có ca đánh nào đang mở hoặc sắp diễn ra'
                : statusFilter === 'COMPLETED'
                ? 'Chưa có ca đánh nào kết thúc'
                : 'Hiện chưa có ca đánh nào được mở'}
            </p>
            <p className="text-slate-500 text-xs font-semibold">
              {statusFilter !== 'ALL'
                ? 'Bạn có thể chọn tab "Tất cả" để xem toàn bộ lịch hoạt động.'
                : 'Vui lòng quay lại sau hoặc liên hệ Host.'}
            </p>
            {statusFilter !== 'ALL' && (
              <button
                onClick={() => setStatusFilter('ALL')}
                className="mt-2 px-4 py-2 bg-slate-950 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                Xem tất cả ca
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {sortedAndFilteredSessions.map((session) => {
              const start = formatDateTime(session.startTime)
              const end = formatDateTime(session.endTime)
              const isFull = session.bookedSlots >= session.maxSlots
              const effectiveStatus = session.effectiveStatus

              return (
                <div
                  key={session.id}
                  onClick={() => navigate(`/sessions/${session.id}`)}
                  className={`saas-card-interactive rounded-3xl p-5 sm:p-6 cursor-pointer flex flex-col justify-between group relative border transition-all duration-200 ${
                    effectiveStatus === 'ACTIVE'
                      ? 'border-rose-400/80 shadow-xl shadow-rose-600/10 ring-2 ring-rose-500/20 bg-gradient-to-b from-rose-50/20 to-white'
                      : effectiveStatus === 'UPCOMING'
                      ? 'border-slate-300 shadow-lg shadow-slate-900/[0.04]'
                      : 'border-slate-200/80 bg-slate-50/50 opacity-90 hover:opacity-100 shadow-sm'
                  }`}
                >
                  <div className="space-y-3.5 sm:space-y-4">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 sm:px-3 py-1 rounded-full border ${
                            effectiveStatus === 'ACTIVE'
                              ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-sm animate-pulse'
                              : effectiveStatus === 'UPCOMING'
                              ? 'bg-slate-950 text-white border-slate-950 shadow-sm'
                              : 'bg-slate-200/80 text-slate-600 border-slate-300'
                          }`}
                        >
                          {effectiveStatus === 'ACTIVE'
                            ? '• Đang diễn ra'
                            : effectiveStatus === 'UPCOMING'
                            ? 'Sắp diễn ra'
                            : 'Đã kết thúc'}
                        </span>

                        {session.courtNames && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white text-slate-800 border border-slate-200 shadow-2xs">
                            🏸 {session.courtNames}
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[11px] sm:text-xs font-black px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg border ${
                          isFull
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {session.bookedSlots}/{session.maxSlots} Slots {isFull && '(Đầy)'}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-black text-base sm:text-lg text-slate-950 group-hover:text-rose-700 transition leading-snug line-clamp-2">
                      {session.title}
                    </h3>

                    {/* Venue & Location Details Box */}
                    <div className="space-y-2 text-xs text-slate-700 bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-950 shrink-0" />
                        <span className="truncate font-bold text-slate-950">{session.venueName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-500 shrink-0" />
                        <span className="text-slate-800 font-semibold">
                          {start.day}, {start.time} - {end.time}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 text-[11px] font-medium pt-0.5">
                        <Users size={13} className="text-slate-500 shrink-0" />
                        <span>Host: <b className="text-slate-950 font-bold">{session.hostName}</b></span>
                      </div>
                    </div>
                  </div>

                  {/* Perks & Benefits Bottom Bar */}
                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Sparkles size={13} className="text-amber-500 shrink-0" />
                        <span className="text-[10px] sm:text-[11px] text-slate-800 font-black">Ưu đãi:</span>
                        {session.startTime && session.endTime && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white text-slate-700 border border-slate-200">
                            Ca {Math.round(((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60)) * 10) / 10}h
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                        <span className="text-rose-600 font-bold">Trợ giá Nữ</span>
                        <span>•</span>
                        <span>Tích điểm đổi nước</span>
                      </div>
                    </div>

                    {user?.role === 'HOST' && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/host/session/${session.id}`)
                          }}
                          className="px-2 sm:px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition flex items-center gap-1 text-[10px] sm:text-[11px] font-black z-10 active:scale-95 cursor-pointer"
                          title="Mở Bảng điều khiển Host (Bắt kèo, Điểm danh, Thu tiền)"
                        >
                          <ShieldCheck size={12} />
                          <span className="hidden xs:inline">Host Panel</span>
                        </button>

                        <button
                          onClick={(e) => handleOpenEditModal(e, session)}
                          className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border border-slate-200 rounded-xl shadow-2xs transition flex items-center gap-1 text-[10px] sm:text-[11px] font-bold z-10 active:scale-95 cursor-pointer"
                          title="Sửa nhanh ngày giờ, sân & bảng giá ca đánh này"
                        >
                          <Settings size={12} className="text-slate-600" />
                          <span className="hidden sm:inline">Sửa ca</span>
                        </button>
                      </div>
                    )}
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
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 space-y-5 relative max-h-[90vh] overflow-y-auto"
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
              <h3 className="text-xl font-black text-slate-950">Chỉnh sửa thông tin ca đánh</h3>
              <p className="text-xs text-slate-500 font-medium">
                Cập nhật nhanh danh sách sân, quân số, địa điểm và bảng giá slot
              </p>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Tiêu đề */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Tiêu đề ca đánh</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Ví dụ: Giao lưu cầu lông tối..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-slate-950 focus:outline-none transition"
                />
              </div>

              {/* Ngày & Khung giờ ca đánh */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-rose-50/50 border border-rose-200/80 rounded-2xl">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock size={13} className="text-rose-600" />
                    <span>Thời gian bắt đầu</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                    className="w-full bg-white border border-rose-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-200"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock size={13} className="text-rose-600" />
                    <span>Thời gian kết thúc</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                    className="w-full bg-white border border-rose-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-200"
                    required
                  />
                </div>
              </div>

              {/* Địa điểm sân & Địa chỉ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Tên sân cầu lông</label>
                  <input
                    type="text"
                    value={editForm.venueName}
                    onChange={(e) => setEditForm({ ...editForm, venueName: e.target.value })}
                    placeholder="VD: Sân Cầu Lông Đại Phát"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-slate-950 focus:outline-none transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Địa chỉ chi tiết</label>
                  <input
                    type="text"
                    value={editForm.venueAddress}
                    onChange={(e) => setEditForm({ ...editForm, venueAddress: e.target.value })}
                    placeholder="VD: 123 Đường ABC, Quận..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-slate-950 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Danh sách sân & Max slots */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Danh sách sân
                  </label>
                  <input
                    type="text"
                    value={editForm.courtNames}
                    onChange={(e) => setEditForm({ ...editForm, courtNames: e.target.value })}
                    placeholder="Ví dụ: Sân 1, Sân 2"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-slate-950 focus:outline-none transition"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Tổng slot (Max)</span>
                    <span className="text-slate-500 text-[10px]">Hiện: <b>{editingSession.bookedSlots} người</b></span>
                  </label>
                  <input
                    type="number"
                    min={editingSession.bookedSlots || 1}
                    max={60}
                    value={editForm.maxSlots}
                    onChange={(e) => setEditForm({ ...editForm, maxSlots: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-slate-950 focus:outline-none transition"
                    required
                  />
                </div>
              </div>

              {/* Bảng giá Full Ca */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="text-[11px] font-black uppercase text-slate-800 tracking-wider">
                  💰 Giá Full Ca (VNĐ)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Cố định Nam</label>
                    <input
                      type="number"
                      value={editForm.memberMalePrice}
                      onChange={(e) => setEditForm({ ...editForm, memberMalePrice: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Cố định Nữ</label>
                    <input
                      type="number"
                      value={editForm.memberFemalePrice}
                      onChange={(e) => setEditForm({ ...editForm, memberFemalePrice: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Vãng lai Nam</label>
                    <input
                      type="number"
                      value={editForm.guestMalePrice}
                      onChange={(e) => setEditForm({ ...editForm, guestMalePrice: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Vãng lai Nữ</label>
                    <input
                      type="number"
                      value={editForm.guestFemalePrice}
                      onChange={(e) => setEditForm({ ...editForm, guestFemalePrice: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Bảng giá Ca 2 Tiếng (Tùy chọn) */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="text-[11px] font-black uppercase text-slate-800 tracking-wider">
                  ⏱️ Giá Ca 2 Tiếng (Tùy chọn - VNĐ)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">2h Cố định Nam</label>
                    <input
                      type="number"
                      value={editForm.memberMalePrice2h || 0}
                      onChange={(e) => setEditForm({ ...editForm, memberMalePrice2h: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">2h Cố định Nữ</label>
                    <input
                      type="number"
                      value={editForm.memberFemalePrice2h || 0}
                      onChange={(e) => setEditForm({ ...editForm, memberFemalePrice2h: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">2h Vãng lai Nam</label>
                    <input
                      type="number"
                      value={editForm.guestMalePrice2h || 0}
                      onChange={(e) => setEditForm({ ...editForm, guestMalePrice2h: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">2h Vãng lai Nữ</label>
                    <input
                      type="number"
                      value={editForm.guestFemalePrice2h || 0}
                      onChange={(e) => setEditForm({ ...editForm, guestFemalePrice2h: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Chi phí vận hành ca & Tiền cọc */}
              <div className="p-3.5 bg-rose-50/50 rounded-2xl border border-rose-200/80 space-y-2.5">
                <div className="text-[11px] font-black uppercase text-rose-900 tracking-wider flex items-center justify-between">
                  <span>🧾 Chi phí vận hành ca & Cọc (VNĐ)</span>
                  <span className="text-[10px] font-normal text-slate-500">Tự động tính lãi lỗ</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Tiền thuê sân</label>
                    <input
                      type="number"
                      value={editForm.costCourt || 0}
                      onChange={(e) => setEditForm({ ...editForm, costCourt: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Tiền cầu lông</label>
                    <input
                      type="number"
                      value={editForm.costShuttlecock || 0}
                      onChange={(e) => setEditForm({ ...editForm, costShuttlecock: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Nước uống / Khác</label>
                    <input
                      type="number"
                      value={editForm.costDrinks || 0}
                      onChange={(e) => setEditForm({ ...editForm, costDrinks: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Mức cọc (Vãng lai)</label>
                    <input
                      type="number"
                      value={editForm.depositAmount || 0}
                      onChange={(e) => setEditForm({ ...editForm, depositAmount: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
