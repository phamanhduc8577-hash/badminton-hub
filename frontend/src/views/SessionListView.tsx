import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { SessionItem, LeaderboardPage } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
import { CurrencyInput } from '../components/CurrencyInput'
import { useToast } from '../components/ToastProvider'
import { Shuttlecock3D } from '../components/3d/Shuttlecock3D'
import { durationHours, formatSessionDateTime, parseServerDateTime, serverToDateTimeInput } from '../lib/dateUtils'
import { getEffectiveSessionStatus, SESSION_STATUS_LABEL } from '../lib/sessionStatus'
import { getLolRank, getPlayerRankDisplay } from '../lib/ranks'
import { RankEmblem } from '../components/RankEmblem'
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
  Settings,
  X,
  Layers,
  Calendar,
  History,
  CheckCircle,
  RotateCcw,
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
    // Giá gói 2h: null = để trống (ca không có giá 2h cho ô này)
    memberMalePrice2h: null as number | null,
    memberFemalePrice2h: null as number | null,
    guestMalePrice2h: null as number | null,
    guestFemalePrice2h: null as number | null,
    costCourt: 0,
    costShuttlecock: 0,
    costDrinks: 0,
    depositAmount: 0,
  })

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MY_SESSIONS' | 'ACTIVE_UPCOMING' | 'COMPLETED'>('ALL')

  const { data: sessions, isLoading, error, refetch } = useQuery<SessionItem[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await api.get('/sessions')
      return res.data
    },
  })

  // Tab chọn loại bảng xếp hạng preview: 'wins' (Thành tích LP) hoặc 'attendance' (Chuyên cần)
  const [leaderboardTab, setLeaderboardTab] = useState<'attendance' | 'wins'>('wins')

  // Đồng bộ Bảng xếp hạng trực tiếp với trang Leaderboard (/leaderboards/attendance hoặc /leaderboards/wins)
  const { data: topPlayersData, isLoading: isLoadingTopPlayers } = useQuery<LeaderboardPage>({
    queryKey: ['leaderboards', leaderboardTab, 'preview'],
    queryFn: async () => {
      const res = await api.get(`/leaderboards/${leaderboardTab}`, {
        params: { page: 0, size: 4 },
      })
      return res.data
    },
    staleTime: 60_000,
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
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['session', String(vars.sessionId)] })
      queryClient.invalidateQueries({ queryKey: ['report', String(vars.sessionId)] })
      setEditingSession(null)
      showToast('Đã cập nhật thông tin ca đánh thành công!', 'success')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể cập nhật ca đánh!', 'error')
    },
  })

  const formatForDateTimeLocal = (dStr: string) => serverToDateTimeInput(dStr)

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
      memberMalePrice2h: session.memberMalePrice2h ?? null,
      memberFemalePrice2h: session.memberFemalePrice2h ?? null,
      guestMalePrice2h: session.guestMalePrice2h ?? null,
      guestFemalePrice2h: session.guestFemalePrice2h ?? null,
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
      const s = parseServerDateTime(editForm.startTime).getTime()
      const end = parseServerDateTime(editForm.endTime).getTime()
      if (end <= s) {
        showToast('Giờ kết thúc phải sau giờ bắt đầu!', 'error')
        return
      }
    }

    // Đảm bảo định dạng chuẩn ISO giây "YYYY-MM-DDTHH:mm:ss"
    const formatToFullIso = (val: string) => {
      if (!val) return undefined
      return val.length === 16 ? `${val}:00` : val
    }

    const twoHourKeys = ['memberMalePrice2h', 'memberFemalePrice2h', 'guestMalePrice2h', 'guestFemalePrice2h'] as const
    const allTwoHourEmpty = twoHourKeys.every((k) => editForm[k] === null)
    const hadTwoHourPrice = twoHourKeys.some((k) => editingSession[k] !== null && editingSession[k] !== undefined)
    const clearedSome = twoHourKeys.some(
      (k) => editForm[k] === null && editingSession[k] !== null && editingSession[k] !== undefined
    )
    if (!allTwoHourEmpty && clearedSome) {
      showToast('Muốn bỏ giá gói 2 tiếng, vui lòng xóa trống cả 4 ô giá 2 tiếng (hoặc nhập lại giá cho ô vừa xóa)!', 'error')
      return
    }
    const clearTwoHourPrices = allTwoHourEmpty && hadTwoHourPrice
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
        memberMalePrice2h: editForm.memberMalePrice2h,
        memberFemalePrice2h: editForm.memberFemalePrice2h,
        guestMalePrice2h: editForm.guestMalePrice2h,
        guestFemalePrice2h: editForm.guestFemalePrice2h,
        ...(clearTwoHourPrices ? { clearTwoHourPrices: true } : {}),
        costCourt: Number(editForm.costCourt || 0),
        costShuttlecock: Number(editForm.costShuttlecock || 0),
        costDrinks: Number(editForm.costDrinks || 0),
        depositAmount: Number(editForm.depositAmount || 0),
      },
    })
  }

  const getEffectiveStatus = (session: SessionItem) => getEffectiveSessionStatus(session)

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

      const timeA = parseServerDateTime(a.startTime).getTime()
      const timeB = parseServerDateTime(b.startTime).getTime()

      if (a.effectiveStatus === 'COMPLETED' || a.effectiveStatus === 'CANCELLED') {
        return timeB - timeA // Ca mới kết thúc xếp trên
      }
      return timeA - timeB // Ca sắp tới gần nhất xếp trên
    })

    if (statusFilter === 'MY_SESSIONS') {
      return sorted.filter((s) => Boolean(s.isBookedByCurrentUser))
    }
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
    if (!sessions) return { total: 0, mySessions: 0, activeUpcoming: 0, completed: 0 }
    let mySessions = 0
    let activeUpcoming = 0
    let completed = 0
    sessions.forEach((s) => {
      if (s.isBookedByCurrentUser) mySessions++
      const st = getEffectiveStatus(s)
      if (st === 'ACTIVE' || st === 'UPCOMING') activeUpcoming++
      else completed++
    })
    return {
      total: sessions.length,
      mySessions,
      activeUpcoming,
      completed,
    }
  }, [sessions])

  // Ca đấu kế tiếp mà user đã đăng ký
  const nextSession = React.useMemo(() => {
    if (!sessions || !user) return null
    return (
      sessions.find(
        (s) => s.isBookedByCurrentUser && (getEffectiveStatus(s) === 'ACTIVE' || getEffectiveStatus(s) === 'UPCOMING')
      ) || null
    )
  }, [sessions, user])

  return (
    <div className="space-y-8">
      {/* 1. Athletic Editorial Hero & Floating 3D Shuttlecock Showcase */}
      <div className="space-y-4">
        {nextSession ? (
          <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 flex-1 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Ca kế tiếp của bạn
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    • {formatDateTime(nextSession.startTime).day}
                  </span>
                </div>

                <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                  {nextSession.title}
                </h2>

                <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                    <Clock size={14} className="text-emerald-400" />
                    <b>{formatDateTime(nextSession.startTime).time} — {formatDateTime(nextSession.endTime).time}</b>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <MapPin size={14} className="text-slate-400" />
                    <span>{nextSession.venueName}</span>
                  </span>
                  {nextSession.courtNames && (
                    <span className="font-semibold text-slate-200 px-2.5 py-0.5 bg-white/10 rounded-md border border-white/10">
                      {nextSession.courtNames}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-5 shrink-0">
                <button
                  onClick={() => navigate(`/sessions/${nextSession.id}`)}
                  className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <span>Xem chi tiết & Điểm danh</span>
                  <ChevronRight size={15} />
                </button>
                <div className="hidden sm:flex items-center justify-center">
                  <Shuttlecock3D size={84} showShadow={false} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              {/* Left Column: Authentic Sports Club Hero */}
              <div className="lg:col-span-7 space-y-4 text-left">
                <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                  CLB CẦU LÔNG LÀNG ĐỊA NGỤC
                </div>

                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                  Lịch ca đánh
                </h1>

                {/* Quick CTA Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {user?.role === 'HOST' ? (
                    <button
                      onClick={() => navigate('/host/create-session')}
                      className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition active:scale-95 cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>Tạo ca mới</span>
                    </button>
                  ) : !user ? (
                    <button
                      onClick={() => navigate('/login')}
                      className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                    >
                      <span>Đăng nhập</span>
                      <ChevronRight size={15} />
                    </button>
                  ) : (
                    <div className="text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl">
                      Chào, <b className="text-white font-bold">{user.fullName}</b> ({user.sessionsAttended} buổi)
                    </div>
                  )}

                  <button
                    onClick={() => navigate('/leaderboard')}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
                    title="Xem Bảng xếp hạng"
                  >
                    <span>Bảng xếp hạng</span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Right Column: Floating Signature 3D Shuttlecock */}
              <div className="lg:col-span-5 flex items-center justify-center relative py-2">
                <Shuttlecock3D size={145} animated={true} showShadow={true} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Leaderboard Standings Preview - Synchronized with Live Leaderboard */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 shadow-2xs">
              <Trophy size={16} />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                Top 4 của bảng xếp hạng
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                {leaderboardTab === 'wins' ? 'Top chiến thần gánh team & điểm LP xếp hạng' : 'Top thành viên chuyên cần tham gia nhiều ca nhất'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch Chuyên cần / Thành tích */}
            <div role="tablist" aria-label="Loại bảng xếp hạng" className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                role="tab"
                aria-selected={leaderboardTab === 'attendance'}
                onClick={() => setLeaderboardTab('attendance')}
                className={`py-1 px-2.5 rounded-lg transition cursor-pointer text-[11px] whitespace-nowrap ${
                  leaderboardTab === 'attendance'
                    ? 'bg-white text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Chuyên cần
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={leaderboardTab === 'wins'}
                onClick={() => setLeaderboardTab('wins')}
                className={`py-1 px-2.5 rounded-lg transition cursor-pointer text-[11px] whitespace-nowrap ${
                  leaderboardTab === 'wins'
                    ? 'bg-white text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Thành tích
              </button>
            </div>

            <button
              onClick={() => navigate('/leaderboard')}
              className="text-xs font-bold text-slate-600 hover:text-slate-950 transition flex items-center gap-1 cursor-pointer px-2 py-1.5 rounded-xl hover:bg-slate-100 shrink-0"
            >
              <span>Xem tất cả</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {isLoadingTopPlayers ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(topPlayersData?.entries && topPlayersData.entries.length > 0
              ? topPlayersData.entries.slice(0, 4)
              : [
                  { id: 1, rank: 1, fullName: 'Võ Long', eloScore: 1650, sessionsAttended: 18, placementMatches: 0, shieldMatches: 0, avatarUrl: '' },
                  { id: 2, rank: 2, fullName: 'Phạm Đức', eloScore: 1520, sessionsAttended: 14, placementMatches: 0, shieldMatches: 0, avatarUrl: '' },
                  { id: 3, rank: 3, fullName: 'Minh Trí', eloScore: 1440, sessionsAttended: 11, placementMatches: 0, shieldMatches: 0, avatarUrl: '' },
                  { id: 4, rank: 4, fullName: 'Hoàng Nam', eloScore: 1360, sessionsAttended: 9, placementMatches: 0, shieldMatches: 0, avatarUrl: '' },
                ]
            ).map((entry, idx) => {
              const rank = entry.rank || idx + 1
              const rankDisplay = getPlayerRankDisplay(
                entry.eloScore ?? 0,
                entry.placementMatches ?? 0,
                entry.shieldMatches ?? 0
              )
              const baseTier = getLolRank(entry.eloScore ?? 0)
              const isFirst = rank === 1
              const isSecond = rank === 2
              const isThird = rank === 3

              return (
                <div
                  key={entry.id}
                  onClick={() => navigate('/leaderboard')}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 flex items-center gap-3 cursor-pointer group hover:scale-[1.02] hover:shadow-md ${
                    isFirst
                      ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                      : isSecond
                      ? 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                      : isThird
                      ? 'bg-amber-50/20 border-amber-200/60 hover:border-amber-300/80'
                      : 'bg-slate-50/50 border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  {/* Rank Badge */}
                  <div className="shrink-0 relative">
                    {isFirst ? (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-md shadow-amber-400/30 border border-yellow-200">
                        👑
                      </div>
                    ) : isSecond ? (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-300 via-slate-100 to-slate-400 text-slate-900 flex items-center justify-center font-black text-xs shadow-xs border border-slate-200">
                        🥈
                      </div>
                    ) : isThird ? (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-700 via-amber-600 to-yellow-800 text-white flex items-center justify-center font-black text-xs shadow-xs border border-amber-500">
                        🥉
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 font-black text-xs flex items-center justify-center border border-slate-200">
                        #{rank}
                      </div>
                    )}
                  </div>

                  {/* 3D Rank Emblem Crest */}
                  <div className="shrink-0 -my-2">
                    <RankEmblem tier={baseTier} size="sm" showGlow={isFirst || isSecond} />
                  </div>

                  {/* Player Avatar & Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <DuckMascot
                        src={entry.avatarUrl || '/duck-mascot.png'}
                        size={22}
                        rounded="full"
                        className="shrink-0 border border-slate-200 shadow-2xs"
                      />
                      <span className="text-xs font-black text-slate-900 group-hover:text-emerald-700 transition truncate block">
                        {entry.fullName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {leaderboardTab === 'wins' ? (
                        <>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded border leading-tight ${rankDisplay.bgClass} ${rankDisplay.borderClass} ${rankDisplay.textColor}`}
                          >
                            {rankDisplay.name}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 truncate">
                            {entry.eloScore ?? 0} LP
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {entry.sessionsAttended ?? 0} buổi tham gia
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. Main Sessions Grid Feed */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Danh sách ca
            </h2>
          </div>

          {/* Status Filter Tabs - Mobile Responsive Pill Group */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl w-full sm:w-auto overflow-x-auto no-scrollbar shadow-inner touch-pan-x">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`min-h-10 px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <Calendar size={13} />
              <span>Tất cả ({counts.total})</span>
            </button>

            {user && (
              <button
                onClick={() => setStatusFilter('MY_SESSIONS')}
                className={`min-h-10 px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                  statusFilter === 'MY_SESSIONS'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <CheckCircle size={13} className={statusFilter === 'MY_SESSIONS' ? 'text-white' : 'text-emerald-600'} />
                <span>Ca của tôi ({counts.mySessions})</span>
              </button>
            )}

            <button
              onClick={() => setStatusFilter('ACTIVE_UPCOMING')}
              className={`min-h-10 px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
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
              className={`min-h-10 px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
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
          <div className="text-center py-12 px-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60">
              <Activity size={22} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">
                Không thể kết nối máy chủ backend. Vui lòng kiểm tra lại.
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Dữ liệu trên localhost đang chờ server backend khởi chạy. Bấm nút bên dưới để thử kết nối lại.
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Thử lại kết nối</span>
            </button>
          </div>
        ) : sortedAndFilteredSessions.length === 0 ? (
          <div className="text-center py-16 saas-card rounded-3xl space-y-3 border border-slate-200">
            <DuckMascot size={64} rounded="2xl" className="mx-auto opacity-70" />
            <p className="text-slate-950 font-black text-lg">
              {statusFilter === 'MY_SESSIONS'
                ? 'Bạn chưa đăng ký tham gia ca đánh nào'
                : statusFilter === 'ACTIVE_UPCOMING'
                ? 'Không có ca đánh nào đang mở hoặc sắp diễn ra'
                : statusFilter === 'COMPLETED'
                ? 'Chưa có ca đánh nào kết thúc'
                : 'Hiện chưa có ca đánh nào được mở'}
            </p>
            <p className="text-slate-500 text-xs font-semibold">
              {statusFilter !== 'ALL'
                ? 'Bạn có thể chọn tab "Tất cả" hoặc "Sắp tới" để khám phá và đăng ký ca.'
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
              const durHours = durationHours(session.startTime, session.endTime)

              return (
                <div
                  key={session.id}
                  onClick={() => navigate(`/sessions/${session.id}`)}
                  className={`bg-white rounded-3xl p-5 sm:p-6 cursor-pointer flex flex-col justify-between group relative border transition-all duration-200 hover:shadow-xl ${
                    effectiveStatus === 'ACTIVE'
                      ? 'border-emerald-400 shadow-lg shadow-emerald-500/5 ring-2 ring-emerald-500/20'
                      : effectiveStatus === 'UPCOMING'
                      ? 'border-slate-200/90 hover:border-slate-400 shadow-xs'
                      : 'border-slate-200/80 bg-slate-50/40 opacity-90 hover:opacity-100 shadow-2xs'
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Header Badges Pill Row */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {session.isBookedByCurrentUser && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-xs">
                            <CheckCircle size={12} className="text-white" />
                            <span>Đã đăng ký</span>
                          </span>
                        )}

                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                            effectiveStatus === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                              : effectiveStatus === 'UPCOMING'
                              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                              : effectiveStatus === 'CANCELLED'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {SESSION_STATUS_LABEL[effectiveStatus]}
                        </span>

                        {session.courtNames && (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80">
                            🏸 {session.courtNames}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                            isFull
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50/80 text-emerald-800 border-emerald-200/80'
                          }`}
                        >
                          {session.bookedSlots}/{session.maxSlots} Slots {isFull && '(Đầy)'}
                        </span>
                      </div>
                    </div>

                    {/* Main Title */}
                    <h3 className="font-black text-base sm:text-lg text-slate-950 group-hover:text-emerald-700 transition leading-snug line-clamp-1">
                      {session.title}
                    </h3>

                    {/* Inner Details Container (Rounded Inset Gray Box matching photo 9, 10, 13) */}
                    <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/70 space-y-2">
                      {/* Venue Name in uppercase bold with location pin */}
                      <div className="flex items-center gap-2">
                        <MapPin size={15} className="text-emerald-600 shrink-0" />
                        <h4 className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-tight truncate">
                          {session.venueName || 'SÂN ĐẠI PHÁT'}
                        </h4>
                      </div>

                      {/* Time Schedule */}
                      <div className="flex items-center gap-2 text-xs text-slate-700">
                        <Clock size={14} className="text-slate-400 shrink-0" />
                        <span className="font-semibold">
                          {start.day}, <b>{start.time} - {end.time}</b>
                        </span>
                      </div>

                      {/* Host Info */}
                      <div className="flex items-center gap-2 text-xs text-slate-600 pt-0.5 border-t border-slate-200/40">
                        <Users size={13} className="text-slate-400 shrink-0" />
                        <span>
                          Host: <b className="text-slate-900 font-bold">{session.hostName}</b>
                        </span>
                      </div>
                    </div>

                    {/* Perks Banner (Ưu đãi: [Ca 3h pill] Trợ giá Nữ • Tích điểm đổi nước) */}
                    <div className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-[11px] text-emerald-800 font-bold flex-wrap">
                      <div className="flex items-center gap-1 shrink-0">
                        <span>Ưu đãi:</span>
                        {durHours !== null && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                            Ca {durHours}h
                          </span>
                        )}
                      </div>
                      <span className="truncate">
                        Trợ giá Nữ • Tích điểm đổi nước
                      </span>
                    </div>
                  </div>

                  {/* Card Bottom Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/80 truncate">
                        {session.memberMalePrice ? `${Math.round(session.memberMalePrice / 1000)}k` : 'Miễn phí'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {user?.role === 'HOST' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/host/session/${session.id}`)
                            }}
                            className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition flex items-center justify-center text-xs font-bold z-10 active:scale-95 cursor-pointer"
                            title="Host Panel"
                          >
                            <ShieldCheck size={16} />
                          </button>

                          <button
                            onClick={(e) => handleOpenEditModal(e, session)}
                            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border border-slate-200 shadow-xs transition flex items-center justify-center text-xs font-medium z-10 active:scale-95 cursor-pointer"
                            title="Sửa nhanh thông tin ca"
                            aria-label="Sửa ca"
                          >
                            <Settings size={16} className="text-slate-600" />
                          </button>
                        </>
                      )}

                      <span className="text-slate-400 group-hover:text-slate-900 transition font-bold inline-flex items-center gap-0.5 text-xs">
                        <span>Chi tiết</span>
                        <ChevronRight size={14} />
                      </span>
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
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 space-y-5 relative max-h-[90dvh] overflow-y-auto overscroll-contain"
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
                    <CurrencyInput
                      value={editForm.memberMalePrice}
                      onChange={(val) => setEditForm({ ...editForm, memberMalePrice: val })}
                      placeholder="0"
                      suffix=""
                      className="text-xs !p-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Cố định Nữ</label>
                    <CurrencyInput
                      value={editForm.memberFemalePrice}
                      onChange={(val) => setEditForm({ ...editForm, memberFemalePrice: val })}
                      placeholder="0"
                      suffix=""
                      className="text-xs !p-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Vãng lai Nam</label>
                    <CurrencyInput
                      value={editForm.guestMalePrice}
                      onChange={(val) => setEditForm({ ...editForm, guestMalePrice: val })}
                      placeholder="0"
                      suffix=""
                      className="text-xs !p-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Vãng lai Nữ</label>
                    <CurrencyInput
                      value={editForm.guestFemalePrice}
                      onChange={(val) => setEditForm({ ...editForm, guestFemalePrice: val })}
                      placeholder="0"
                      suffix=""
                      className="text-xs !p-2 rounded-lg"
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
                    <CurrencyInput
                      value={editForm.memberMalePrice2h ?? undefined}
                      onChange={(val) => setEditForm({ ...editForm, memberMalePrice2h: val > 0 ? val : null })}
                      placeholder="0"
                      suffix=""
                      className="text-xs !p-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">2h Cố định Nữ</label>
                    <CurrencyInput
                      value={editForm.memberFemalePrice2h ?? undefined}
                      onChange={(val) => setEditForm({ ...editForm, memberFemalePrice2h: val > 0 ? val : null })}
                      placeholder="0"
                      suffix=""
                      className="text-xs !p-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">2h Vãng lai Nam</label>
                    <CurrencyInput
                      value={editForm.guestMalePrice2h ?? undefined}
                      onChange={(val) => setEditForm({ ...editForm, guestMalePrice2h: val > 0 ? val : null })}
                      placeholder="0"
                      suffix=""
                      className="text-xs !p-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">2h Vãng lai Nữ</label>
                    <CurrencyInput
                      value={editForm.guestFemalePrice2h ?? undefined}
                      onChange={(val) => setEditForm({ ...editForm, guestFemalePrice2h: val > 0 ? val : null })}
                      placeholder="0"
                      suffix=""
                      className="text-xs !p-2 rounded-lg"
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
                    <CurrencyInput
                      value={editForm.costCourt || 0}
                      onChange={(val) => setEditForm({ ...editForm, costCourt: val })}
                      placeholder="0"
                      suffix=""
                      className="text-xs !p-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Tiền cầu lông</label>
                    <CurrencyInput
                      value={editForm.costShuttlecock || 0}
                      onChange={(val) => setEditForm({ ...editForm, costShuttlecock: val })}
                      placeholder="0"
                      suffix=""
                      className="text-xs !p-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Nước uống / Khác</label>
                    <CurrencyInput
                      value={editForm.costDrinks || 0}
                      onChange={(val) => setEditForm({ ...editForm, costDrinks: val })}
                      placeholder="0"
                      suffix=""
                      className="text-xs !p-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Mức cọc (Vãng lai)</label>
                    <CurrencyInput
                      value={editForm.depositAmount || 0}
                      onChange={(val) => setEditForm({ ...editForm, depositAmount: val })}
                      placeholder="0"
                      suffix=""
                      className="text-xs !p-2 rounded-lg"
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

export default SessionListView
