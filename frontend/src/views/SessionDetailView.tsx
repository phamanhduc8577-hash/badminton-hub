import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { SessionItem, Participant, Match } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { QrCameraScanner } from '../components/QrCameraScanner'
import { DuckMascot } from '../components/DuckMascot'
import { BottomSheet } from '../components/BottomSheet'
import { useToast } from '../components/ToastProvider'
import { formatSessionDateTime, parseServerDate } from '../lib/dateUtils'
import { getEffectiveSessionStatus, SESSION_STATUS_LABEL } from '../lib/sessionStatus'
import {
  Clock,
  MapPin,
  Users,
  ShieldCheck,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Camera,
  DollarSign,
  Shield,
  ArrowLeft,
  Calendar,
  Sparkles,
  Check,
  Loader2,
} from 'lucide-react'

const getErrorMessage = (err: any, fallback: string): string =>
  err?.response?.data?.message || fallback

/** Hiển thị SĐT: Host thấy đủ; server đã che sẵn (có '*') thì giữ nguyên; thiếu SĐT thì ẩn. */
const formatParticipantPhone = (phone: string | undefined | null, viewerIsHost: boolean): string | null => {
  const value = (phone || '').trim()
  if (!value || value.toUpperCase() === 'N/A') return null
  if (viewerIsHost || value.includes('*')) return value
  if (value.length < 7) return '***'
  return `${value.slice(0, 4)}***${value.slice(-3)}`
}

/**
 * Ca có giá 2 tiếng áp được cho hạng + giới tính này không (cùng quy tắc PricingCalculator ở server):
 * cần giá 2h nam của hạng; nữ cần thêm giá 2h nữ (thiếu thì server tính giá nữ full ca).
 */
const hasTwoHourPrice = (session: SessionItem, memberTier: boolean, gender: Participant['gender']): boolean => {
  const male2h = memberTier ? session.memberMalePrice2h : session.guestMalePrice2h
  const female2h = memberTier ? session.memberFemalePrice2h : session.guestFemalePrice2h
  if (male2h === undefined || male2h === null) return false
  return gender !== 'FEMALE' || (female2h !== undefined && female2h !== null)
}

export const SessionDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { showToast } = useToast()

  // State modals
  const [showMemberDepositModal, setShowMemberDepositModal] = useState(false)
  const [showJoinOptionModal, setShowJoinOptionModal] = useState(false)
  const [selectedDurationHours, setSelectedDurationHours] = useState<number | undefined>(undefined)
  const [selectedSlotWindow, setSelectedSlotWindow] = useState<string>('FULL')
  const [showCheckinModal, setShowCheckinModal] = useState(false)
  const [showCameraScanner, setShowCameraScanner] = useState(false)
  const [showPaymentQrModal, setShowPaymentQrModal] = useState<string | null>(null)
  const [showCashNoticeModal, setShowCashNoticeModal] = useState(false)
  const [depositQrData, setDepositQrData] = useState<{ qrUrl: string; participant: Participant } | null>(null)
  const [depositQrLoading, setDepositQrLoading] = useState(false)
  const [paymentPending, setPaymentPending] = useState<'VIETQR' | 'CASH' | null>(null)

  // Checkin states
  const [checkinTokenInput, setCheckinTokenInput] = useState('')
  const [checkinDurationHours, setCheckinDurationHours] = useState<number | undefined>(undefined)
  const [checkinError, setCheckinError] = useState('')
  const [checkinSuccess, setCheckinSuccess] = useState(false)
  const [checkinSubmitting, setCheckinSubmitting] = useState(false)
  const autoCheckinTriggered = useRef(false)

  const findMyParticipant = (s: SessionItem | undefined) =>
    s?.participants?.find((p) => (user?.id && p.userId === user.id) || (user?.phone && p.phone === user.phone))

  const { data: session, isLoading } = useQuery<SessionItem>({
    queryKey: ['session', id],
    queryFn: async () => {
      const res = await api.get(`/sessions/${id}`)
      return res.data
    },
    // Tự tải lại mỗi 15s khi đang chờ Host xác nhận cọc hoặc ca đang diễn ra (điểm danh / thu tiền thay đổi liên tục)
    refetchInterval: (query) => {
      const s = query.state.data
      if (!s) return false
      const status = getEffectiveSessionStatus(s)
      if (status === 'COMPLETED' || status === 'CANCELLED') return false
      const me = findMyParticipant(s)
      const pendingDeposit =
        !!me && Number(me.depositAmount) > 0 && (me.depositStatus === 'PENDING' || me.depositStatus === 'NONE')
      return pendingDeposit || status === 'ACTIVE' ? 15000 : false
    },
  })

  const { data: matches } = useQuery<Match[]>({
    queryKey: ['matches', id],
    queryFn: async () => {
      const res = await api.get(`/matches/session/${id}`)
      return res.data
    },
    enabled: !!id,
    refetchInterval: false,
  })

  // Calculate sets, wins, losses per player for the session
  const playerStatsMap = useMemo(() => {
    const stats: Record<string, { totalSets: number; wins: number; losses: number }> = {}

    if (!session?.participants) return stats

    session.participants.forEach((p) => {
      const uid = String(p.userId || p.id)
      stats[uid] = { totalSets: 0, wins: 0, losses: 0 }
    })

    if (!matches) return stats

    matches.forEach((m) => {
      const pA1 = String(m.teamAPlayer1Id)
      const pA2 = m.teamAPlayer2Id ? String(m.teamAPlayer2Id) : null
      const pB1 = String(m.teamBPlayer1Id)
      const pB2 = m.teamBPlayer2Id ? String(m.teamBPlayer2Id) : null

      const teamAWon = m.winningTeam === 'A'

      const recordPlayer = (id: string, isWinner: boolean) => {
        if (!stats[id]) {
          stats[id] = { totalSets: 0, wins: 0, losses: 0 }
        }
        stats[id].totalSets += 1
        if (isWinner) {
          stats[id].wins += 1
        } else {
          stats[id].losses += 1
        }
      }

      recordPlayer(pA1, teamAWon)
      if (pA2) recordPlayer(pA2, teamAWon)
      recordPlayer(pB1, !teamAWon)
      if (pB2) recordPlayer(pB2, !teamAWon)
    })

    return stats
  }, [session?.participants, matches])

  // Compute MVP player with highest win count in the session (min 1 win)
  const sessionMvp = useMemo<{
    name: string
    avatarUrl?: string
    wins: number
    losses: number
    totalSets: number
  } | null>(() => {
    if (!matches || matches.length === 0 || !session?.participants) return null

    let bestPlayer: {
      name: string
      avatarUrl?: string
      wins: number
      losses: number
      totalSets: number
    } | null = null

    session.participants.forEach((p) => {
      const uid = String(p.userId || p.id)
      const st = playerStatsMap[uid]
      if (!st || st.wins <= 0) return

      if (!bestPlayer || st.wins > bestPlayer.wins || (st.wins === bestPlayer.wins && st.losses < bestPlayer.losses)) {
        bestPlayer = {
          name: p.name || 'Tay vợt',
          avatarUrl: p.avatarUrl,
          wins: st.wins,
          losses: st.losses,
          totalSets: st.totalSets,
        }
      }
    })

    return bestPlayer
  }, [matches, session?.participants, playerStatsMap])

  // Calculate total session hours
  const totalSessionHours = useMemo(() => {
    if (!session?.startTime || !session?.endTime) return 2
    try {
      const start = new Date(session.startTime).getTime()
      const end = new Date(session.endTime).getTime()
      if (start && end && end > start) {
        return Math.round(((end - start) / (1000 * 60 * 60)) * 10) / 10
      }
    } catch (_) {}
    return 2
  }, [session?.startTime, session?.endTime])

  // Sub-slot time windows (e.g. 13:00 - 15:00 vs 14:00 - 16:00)
  const subSlotWindows = useMemo(() => {
    if (!session?.startTime || !session?.endTime || totalSessionHours <= 2) return []
    try {
      const s = new Date(session.startTime)
      const e = new Date(session.endTime)
      const pad = (n: number) => String(n).padStart(2, '0')
      const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

      const windows: { key: string; label: string; duration: number; timeRange: string }[] = []

      // Option 1: Full session
      windows.push({
        key: 'FULL',
        label: `Toàn bộ ca (${totalSessionHours} tiếng)`,
        duration: totalSessionHours,
        timeRange: `${formatTime(s)} - ${formatTime(e)}`,
      })

      // Option 2: 2h Early (Ca đầu)
      const earlyEnd = new Date(s)
      earlyEnd.setHours(earlyEnd.getHours() + 2)
      windows.push({
        key: 'EARLY_2H',
        label: 'Ca đầu 2 Tiếng (Về sớm)',
        duration: 2.0,
        timeRange: `${formatTime(s)} - ${formatTime(earlyEnd)}`,
      })

      // Option 3: 2h Late (Ca sau)
      const lateStart = new Date(e)
      lateStart.setHours(lateStart.getHours() - 2)
      if (lateStart.getTime() > s.getTime()) {
        windows.push({
          key: 'LATE_2H',
          label: 'Ca sau 2 Tiếng (Đến muộn)',
          duration: 2.0,
          timeRange: `${formatTime(lateStart)} - ${formatTime(e)}`,
        })
      }

      return windows
    } catch (_) {
      return []
    }
  }, [session?.startTime, session?.endTime, totalSessionHours])

  // Member join mutation
  const memberJoinMutation = useMutation({
    mutationFn: async (opts?: { durationHours?: number; slotWindow?: string }) => {
      const res = await api.post(`/sessions/${id}/join`, {
        durationHours: opts?.durationHours,
        slotWindow: opts?.slotWindow,
      })
      return res.data as Participant
    },
    onSuccess: async (participant) => {
      setShowJoinOptionModal(false)

      // Nếu là thành viên vãng lai lần đầu (có yêu cầu cọc > 0)
      if (Number(participant.depositAmount) > 0) {
        try {
          const qrRes = await api.get(`/sessions/participants/${participant.id}/deposit-qr`)
          setDepositQrData({ qrUrl: qrRes.data.qrUrl, participant })
          setShowMemberDepositModal(true)
        } catch (e) {
          showToast('Không thể tạo mã VietQR cọc, vui lòng liên hệ trực tiếp Host!', 'error')
        }
      } else {
        showToast('Đăng ký tham gia ca thành công!', 'success')
      }
      queryClient.invalidateQueries({ queryKey: ['session', id] })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Không thể tham gia ca!'
      if (err.response?.status === 401) {
        showToast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!', 'error')
      } else {
        showToast(msg, 'error')
      }
    },
  })

  // Instant Token Checkin (No GPS friction). Trả về thông báo lỗi (nếu có) để nơi gọi xử lý tiếp.
  const handleCheckinSubmit = async (tokenToUse?: string): Promise<{ ok: boolean; error?: string }> => {
    const tokenVal = (tokenToUse || checkinTokenInput).trim().toUpperCase()
    setCheckinError('')
    if (!tokenVal) {
      const msg = 'Vui lòng nhập hoặc quét mã Token điểm danh!'
      setCheckinError(msg)
      return { ok: false, error: msg }
    }

    setCheckinSubmitting(true)
    try {
      await api.post(`/sessions/${id}/checkin`, {
        token: tokenVal,
        durationHours: checkinDurationHours,
      })
      setCheckinSuccess(true)
      showToast('Điểm danh thành công! Chúc bạn chơi vui vẻ 🏸', 'success')
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      return { ok: true }
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Điểm danh thất bại!')
      setCheckinError(msg)
      return { ok: false, error: msg }
    } finally {
      setCheckinSubmitting(false)
    }
  }

  // Auto handle URL token parameter (?token=4ECDACC6 or /sessions/1?token=4ECDACC6)
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token')
    if (tokenFromUrl && session && !autoCheckinTriggered.current) {
      const cleanToken = tokenFromUrl.trim().toUpperCase()
      setCheckinTokenInput(cleanToken)

      // If user not logged in yet, prompt and redirect to login preserving token
      if (!user) {
        showToast('Vui lòng đăng nhập để hoàn tất điểm danh ca đánh này!', 'info')
        navigate(`/login?redirect=${encodeURIComponent(`/sessions/${id}?token=${cleanToken}`)}`)
        return
      }

      setShowCheckinModal(true)

      // If user is already registered in this session and hasn't checked in yet, auto-trigger checkin
      const currentUserParticipant = findMyParticipant(session)
      if (currentUserParticipant && currentUserParticipant.checkinStatus !== 'CHECKED_IN') {
        autoCheckinTriggered.current = true
        handleCheckinSubmit(cleanToken)
      }
    }
  }, [searchParams, session, user])

  // Mở form nhập mã tay (từ nút trong máy quét hoặc khi quét lỗi)
  const openManualCheckin = (errorMessage?: string) => {
    setShowCameraScanner(false)
    setCheckinSuccess(false)
    setCheckinError(errorMessage || '')
    setShowCheckinModal(true)
  }

  // Handle Scan QR from Camera
  const handleScanSuccess = async (scannedText: string) => {
    setShowCameraScanner(false)
    let token = scannedText.trim()
    try {
      if (token.startsWith('http')) {
        const url = new URL(token)
        const paramToken = url.searchParams.get('token')
        if (paramToken) token = paramToken
      }
    } catch (_) {}
    const cleanToken = token.toUpperCase()
    setCheckinTokenInput(cleanToken)
    const result = await handleCheckinSubmit(cleanToken)
    if (!result.ok) {
      // Quét lỗi: báo ngay + mở form nhập tay (đã điền sẵn mã vừa quét) kèm lý do
      showToast(result.error || 'Điểm danh thất bại!', 'error')
      openManualCheckin(result.error)
    }
  }

  const handleOpenDepositQr = async (participant: Participant) => {
    if (depositQrLoading) return
    setDepositQrLoading(true)
    try {
      const qrRes = await api.get(`/sessions/participants/${participant.id}/deposit-qr`)
      setDepositQrData({ qrUrl: qrRes.data.qrUrl, participant })
      setShowMemberDepositModal(true)
    } catch (err: any) {
      showToast(getErrorMessage(err, 'Không thể tạo mã VietQR cọc!'), 'error')
    } finally {
      setDepositQrLoading(false)
    }
  }

  const handleOpenFinalPaymentQr = async (participantId: number) => {
    if (paymentPending) return
    setPaymentPending('VIETQR')
    try {
      // Ghi nhận ý định thanh toán VietQR để Host thấy trên bảng điều khiển
      await api.post(`/sessions/participants/${participantId}/select-payment-method`, {
        paymentMethod: 'VIETQR',
      })
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      const res = await api.get(`/sessions/participants/${participantId}/payment-qr`)
      if (res.data?.qrUrl) {
        setShowPaymentQrModal(res.data.qrUrl)
      } else {
        showToast('Không thể tạo mã QR thanh toán!', 'error')
      }
    } catch (err: any) {
      console.error('QR Payment Error:', err)
      showToast(getErrorMessage(err, 'Không thể tạo mã QR thanh toán! Vui lòng kiểm tra kết nối và thử lại.'), 'error')
    } finally {
      setPaymentPending(null)
    }
  }

  const handleSelectCashPayment = async (participantId: number) => {
    if (paymentPending) return
    setPaymentPending('CASH')
    try {
      await api.post(`/sessions/participants/${participantId}/select-payment-method`, {
        paymentMethod: 'CASH',
      })
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      // Chỉ báo "Host đã ghi nhận" khi server thật sự lưu thành công
      setShowCashNoticeModal(true)
    } catch (err: any) {
      showToast(getErrorMessage(err, 'Không thể ghi nhận hình thức Tiền mặt, vui lòng thử lại!'), 'error')
    } finally {
      setPaymentPending(null)
    }
  }

  if (isLoading || !session) {
    return (
      <div className="text-center py-24 text-slate-600 text-sm animate-pulse space-y-3">
        <DuckMascot size={48} rounded="xl" className="mx-auto" />
        <p className="font-semibold">Đang tải thông tin chi tiết ca đánh...</p>
      </div>
    )
  }

  // Find user participant info (Strictly match logged-in user by ID or Phone)
  const isUserParticipant = findMyParticipant(session)
  const isPendingDeposit = isUserParticipant && Number(isUserParticipant.depositAmount) > 0 && isUserParticipant.depositStatus !== 'PAID'
  const isCheckedIn = isUserParticipant?.checkinStatus === 'CHECKED_IN'
  // "Chỉ đánh 2 tiếng" lúc điểm danh chỉ có tác dụng khi ca có giá 2h cho hạng + giới tính của lượt này và chưa thanh toán
  const canChooseTwoHoursAtCheckin =
    !!isUserParticipant &&
    isUserParticipant.paymentStatus !== 'PAID' &&
    hasTwoHourPrice(session, !isUserParticipant.isGuest, isUserParticipant.gender)
  // Chỉ trừ cọc khi Host đã xác nhận nhận cọc (khớp remainingAmount do server tính)
  const depositDeducted =
    !!isUserParticipant && isUserParticipant.depositStatus === 'PAID' && Number(isUserParticipant.depositAmount) > 0
  const isFull = session.bookedSlots >= session.maxSlots
  const effectiveStatus = getEffectiveSessionStatus(session)
  const viewerIsHost = user?.role === 'HOST'
  const checkinTimeLabel = isUserParticipant?.checkinAt
    ? parseServerDate(isUserParticipant.checkinAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : ''
  const spinner = <Loader2 size={15} className="animate-spin" aria-hidden="true" />

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-950 transition bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <ArrowLeft size={15} />
          <span>Quay lại danh sách ca</span>
        </button>

        {user?.role === 'HOST' && (
          <button
            onClick={() => navigate(`/host/session/${session.id}`)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer w-full sm:w-auto"
          >
            <Shield size={15} />
            <span>Mở Host Panel: Bắt Kèo & Quản Lý Ca</span>
          </button>
        )}
      </div>

      {/* Session MVP Highlight Box for all members and host */}
      {sessionMvp && (
        <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 rounded-3xl p-5 sm:p-7 text-slate-950 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="flex items-center gap-3.5 sm:gap-4 relative z-10 min-w-0 flex-1">
            <div className="relative shrink-0">
              <DuckMascot
                src={sessionMvp.avatarUrl || '/duck-mascot.png'}
                size={60}
                rounded="2xl"
                className="border-2 border-slate-950/80 shadow-xl"
              />
              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center text-xs shadow-md border border-amber-400">
                👑
              </div>
            </div>
            <div className="min-w-0 flex-1 pr-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">
                <span>Vinh danh MVP Ca Đấu</span>
              </div>
              <h3 className="text-lg sm:text-2xl font-black truncate" title={sessionMvp.name}>
                {sessionMvp.name}
              </h3>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                Thắng nhiều nhất: <b>{sessionMvp.wins} Thắng</b> (-{sessionMvp.losses} Thua) • {sessionMvp.totalSets} set
              </p>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-yellow-300/80 text-left md:text-right shrink-0 shadow-md relative z-10 md:max-w-xs">
            <span className="text-[10px] sm:text-[11px] font-black uppercase text-amber-900 block">
              Phần thưởng MVP Ca Đấu
            </span>
            <span className="font-black text-xs sm:text-sm text-slate-950 block mt-0.5 whitespace-nowrap">
              🥤 Tặng 01 Nước giải khát Revive
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-600 block mt-0.5 font-semibold">
              (Host trao tặng trực tiếp tại sân)
            </span>
          </div>
        </div>
      )}

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Session Info & Pricing Card (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="saas-card rounded-3xl p-5 sm:p-8 space-y-6 relative">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                  {SESSION_STATUS_LABEL[effectiveStatus]}
                </span>

                {session.courtNames && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-white text-slate-900 border border-slate-300 shadow-2xs">
                    🏸 {session.courtNames} ({session.courtCount || 2} Sân)
                  </span>
                )}
              </div>

              <span className="text-xs text-slate-600">
                Host tổ chức: <b className="text-slate-900 font-bold">{session.hostName}</b>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 leading-tight">
              {session.title}
            </h1>

            {/* Venue & Time Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs text-slate-700">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                  <MapPin size={15} />
                  <span>Địa điểm thi đấu</span>
                </div>
                <p className="text-slate-900 font-bold text-sm mt-1">{session.venueName}</p>
                <p className="text-slate-600 text-[11px] leading-relaxed font-medium">{session.venueAddress}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                  <Clock size={15} className="text-rose-600" />
                  <span>Khung giờ ca đánh</span>
                </div>
                <p className="text-slate-900 font-bold text-sm mt-1">
                  {formatSessionDateTime(session.startTime).time} - {formatSessionDateTime(session.endTime).time}
                </p>
                <p className="text-slate-600 text-[11px] font-medium">
                  {formatSessionDateTime(session.startTime).day}
                </p>
              </div>
            </div>

            {/* Pricing Matrix Banner */}
            <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <DollarSign size={15} className="text-slate-900" />
                  <span>Bảng giá slot tham gia</span>
                </h3>
                {session.startTime && session.endTime && (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-slate-900 text-white shadow-xs">
                    ⏱️ Ca {Math.round(((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60)) * 10) / 10} Giờ
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-[11px] text-slate-800 font-black uppercase tracking-wide">Thành viên CLB</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">Miễn cọc</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 font-bold">Nam:</span>
                      <span className="font-black text-slate-900 text-sm">{Number(session.memberMalePrice).toLocaleString()}đ</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 font-bold">Nữ (Trợ giá):</span>
                      <span className="font-black text-slate-900 text-sm">{Number(session.memberFemalePrice).toLocaleString()}đ</span>
                    </div>
                  </div>
                  {session.memberMalePrice2h && (
                    <div className="pt-2.5 border-t border-slate-100 space-y-1.5 text-xs">
                      <span className="text-slate-800 font-black block text-[11px]">Tùy chọn 2 tiếng:</span>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-700 font-bold">Nam:</span>
                        <span className="font-black text-slate-900">{Number(session.memberMalePrice2h).toLocaleString()}đ</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-700 font-bold">Nữ (Trợ giá):</span>
                        <span className="font-black text-slate-900">{Number(session.memberFemalePrice2h).toLocaleString()}đ</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-[11px] text-slate-800 font-black uppercase tracking-wide">Khách Vãng Lai</span>
                    <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">Cọc {Number(session.depositAmount).toLocaleString()}đ</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 font-bold">Nam:</span>
                      <span className="font-black text-slate-900 text-sm">{Number(session.guestMalePrice).toLocaleString()}đ</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 font-bold">Nữ (Trợ giá):</span>
                      <span className="font-black text-slate-900 text-sm">{Number(session.guestFemalePrice).toLocaleString()}đ</span>
                    </div>
                  </div>
                  {session.guestMalePrice2h && (
                    <div className="pt-2.5 border-t border-slate-100 space-y-1.5 text-xs">
                      <span className="text-slate-800 font-black block text-[11px]">Tùy chọn 2 tiếng:</span>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-700 font-bold">Nam:</span>
                        <span className="font-black text-slate-900">{Number(session.guestMalePrice2h).toLocaleString()}đ</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-700 font-bold">Nữ (Trợ giá):</span>
                        <span className="font-black text-slate-900">{Number(session.guestFemalePrice2h).toLocaleString()}đ</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Bar for User Booking / Checkin */}
            <div className="space-y-3 pt-2">
              {user?.role === 'HOST' && (
                <button
                  onClick={() => navigate(`/host/session/${session.id}`)}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl flex items-center justify-center gap-2 text-xs transition active:scale-95 shadow-md shadow-rose-600/20"
                >
                  <Shield size={16} />
                  <span>Mở Host Panel: Bắt Kèo Đấu & Quản Lý Ca</span>
                </button>
              )}

              {effectiveStatus === 'COMPLETED' || effectiveStatus === 'CANCELLED' ? (
                <div className="w-full py-3.5 bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-xl text-center flex items-center justify-center gap-2 text-xs shadow-sm">
                  <span>
                    {effectiveStatus === 'CANCELLED'
                      ? 'Ca đánh này đã bị hủy (Đã đóng đăng ký)'
                      : 'Ca đánh này đã kết thúc (Đã đóng đăng ký)'}
                  </span>
                </div>
              ) : isPendingDeposit ? (
                /* Thành viên vãng lai lần đầu: Bắt buộc chuyển khoản cọc và chờ Host duyệt mới mở giao diện tham gia */
                <div className="p-5 bg-amber-50/90 border-2 border-dashed border-amber-300 rounded-2xl space-y-4 shadow-sm text-center">
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-200 text-amber-950 font-black rounded-full text-xs animate-pulse">
                      ⏳ Đang chờ Host xác nhận cọc ({Number(isUserParticipant.depositAmount).toLocaleString('vi-VN')}đ)
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm pt-1">
                      Bạn đã đăng ký slot thành công! Vui lòng hoàn tất chuyển khoản cọc.
                    </h4>
                    <p className="text-xs text-slate-600">
                      Sau khi Host xác nhận đã nhận cọc, bạn sẽ được tự động mở đầy đủ chức năng Điểm danh QR và Thanh toán tại sân.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                    <button
                      onClick={() => handleOpenDepositQr(isUserParticipant)}
                      disabled={depositQrLoading}
                      aria-busy={depositQrLoading}
                      className="w-full sm:w-auto min-h-11 px-5 py-2.5 bg-slate-950 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm sm:text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 disabled:active:scale-100"
                    >
                      {depositQrLoading ? spinner : <QrCode size={15} />}
                      <span>
                        {depositQrLoading
                          ? 'Đang tạo mã VietQR...'
                          : `Xem lại mã VietQR Cọc ${Number(isUserParticipant.depositAmount).toLocaleString('vi-VN')}đ`}
                      </span>
                    </button>
                  </div>
                </div>
              ) : isUserParticipant ? (
                <div className="space-y-3">
                  {/* Trạng thái điểm danh & nút checkin nếu chưa đến */}
                  {isCheckedIn ? (
                    <div className="w-full py-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-xl text-center flex items-center justify-center gap-2 text-sm shadow-sm">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      <span>Đã điểm danh lúc {checkinTimeLabel}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
                        <span className="font-semibold">Bạn đã đăng ký slot thành công!</span>
                        <span className="font-bold text-[11px] px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">
                          Chưa điểm danh
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={() => setShowCameraScanner(true)}
                          className="min-h-11 py-3 bg-slate-900 hover:bg-slate-800 font-bold text-white rounded-xl flex items-center justify-center gap-2 text-sm sm:text-xs transition active:scale-95 shadow-sm"
                        >
                          <Camera size={16} />
                          <span>Quét QR sân (Camera)</span>
                        </button>

                        <button
                          onClick={() => openManualCheckin()}
                          className="min-h-11 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-2 text-sm sm:text-xs transition border border-slate-200 active:scale-95 shadow-sm"
                        >
                          <QrCode size={16} />
                          <span>Nhập mã Token</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Thanh toán VietQR & Tiền mặt cho thành viên & khách */}
                  {isUserParticipant.paymentStatus === 'PAID' ? (
                    <div className="w-full py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-2xl text-center flex items-center justify-center gap-2 text-xs shadow-xs">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>Đã thanh toán tiền sân ({isUserParticipant.paymentMethod === 'CASH' ? 'Tiền mặt' : 'VietQR'})</span>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          <DollarSign size={15} />
                          <span>Tiền sân còn lại cần thanh toán:</span>
                        </span>
                        <span className="text-lg font-black text-amber-950 font-mono">
                          {Number(isUserParticipant.remainingAmount).toLocaleString('vi-VN')}đ
                        </span>
                      </div>

                      {/* Chi tiết khấu trừ cọc và voucher nếu có */}
                      <div className="text-[11px] text-amber-900 space-y-1 bg-amber-100/60 p-2.5 rounded-xl">
                        <div className="flex justify-between">
                          <span>• Giá gốc ca đánh:</span>
                          <span className="font-semibold">{Number(isUserParticipant.baseFee || isUserParticipant.finalFee).toLocaleString('vi-VN')}đ</span>
                        </div>
                        {Number(isUserParticipant.adjustmentAmount) !== 0 && (
                          <div className="flex justify-between text-rose-700 font-bold">
                            <span>• {isUserParticipant.adjustmentReason || 'Ưu đãi / Giảm giá'}:</span>
                            <span>{Number(isUserParticipant.adjustmentAmount) > 0 ? '+' : ''}{Number(isUserParticipant.adjustmentAmount).toLocaleString('vi-VN')}đ</span>
                          </div>
                        )}
                        {depositDeducted && (
                          <div className="flex justify-between text-emerald-700 font-medium">
                            <span>• Đã cọc giữ chỗ (Khấu trừ):</span>
                            <span>- {Number(isUserParticipant.depositAmount).toLocaleString('vi-VN')}đ</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-amber-950 pt-1 border-t border-amber-200">
                          <span>• Số tiền cần thanh toán tại sân:</span>
                          <span className="font-mono">{Number(isUserParticipant.remainingAmount).toLocaleString('vi-VN')}đ</span>
                        </div>
                      </div>

                      {/* Intended payment status notice */}
                      {isUserParticipant.paymentMethod && (
                        <div className="text-[11px] font-bold text-amber-900 bg-white border border-amber-300 px-3 py-1.5 rounded-xl flex items-center justify-between shadow-2xs">
                          <span>Hình thức thanh toán đã chọn:</span>
                          <span className="px-2 py-0.5 bg-amber-200/80 text-amber-950 rounded-lg">
                            {isUserParticipant.paymentMethod === 'VIETQR' ? '⚡ Chuyển khoản VietQR' : '💵 Tiền mặt tại sân'}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <button
                          onClick={() => handleOpenFinalPaymentQr(isUserParticipant.id)}
                          disabled={paymentPending !== null}
                          aria-busy={paymentPending === 'VIETQR'}
                          className={`min-h-11 py-2.5 font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm text-sm sm:text-xs disabled:opacity-60 disabled:cursor-not-allowed ${
                            isUserParticipant.paymentMethod === 'VIETQR'
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-400'
                              : 'bg-slate-950 hover:bg-slate-800 text-white'
                          }`}
                        >
                          {paymentPending === 'VIETQR' ? spinner : <QrCode size={15} />}
                          <span>{paymentPending === 'VIETQR' ? 'Đang tạo mã QR...' : 'Quét VietQR chuyển khoản'}</span>
                        </button>

                        <button
                          onClick={() => handleSelectCashPayment(isUserParticipant.id)}
                          disabled={paymentPending !== null}
                          aria-busy={paymentPending === 'CASH'}
                          className={`min-h-11 py-2.5 px-3 rounded-xl font-bold text-sm sm:text-xs flex items-center justify-center gap-1.5 text-center transition border disabled:opacity-60 disabled:cursor-not-allowed ${
                            isUserParticipant.paymentMethod === 'CASH'
                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300'
                              : 'bg-white hover:bg-slate-50 border-amber-300 text-amber-950 shadow-2xs'
                          }`}
                        >
                          {paymentPending === 'CASH' && spinner}
                          <span>{paymentPending === 'CASH' ? 'Đang gửi cho Host...' : '💵 Trả Tiền mặt cho Host'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : user ? (
                <button
                  disabled={isFull || memberJoinMutation.isPending}
                  onClick={() => {
                    if (totalSessionHours > 2 && subSlotWindows.length > 0) {
                      setShowJoinOptionModal(true)
                    } else {
                      memberJoinMutation.mutate({})
                    }
                  }}
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500 font-bold text-white rounded-xl flex items-center justify-center gap-2 text-sm transition active:scale-95 shadow-sm"
                >
                  <Users size={18} />
                  <span>
                    {isFull
                      ? 'Hết Slot Tham Gia'
                      : user.role === 'HOST'
                      ? 'Đăng ký tham gia vào sân đánh (Host tham gia)'
                      : user.membershipType === 'FIXED'
                      ? 'Đăng ký tham gia (Thành viên cố định CLB)'
                      : (user.sessionsAttended ?? 0) > 0
                      ? 'Đăng ký tham gia (Thành viên CLB - Miễn cọc)'
                      : 'Đăng ký tham gia (Khách vãng lai - Cọc 20.000đ)'}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 font-bold text-white rounded-xl flex items-center justify-center gap-2 text-sm transition active:scale-95 shadow-sm"
                >
                  <ShieldCheck size={18} className="text-rose-400" />
                  <span>Đăng nhập hoặc Đăng ký để tham gia ca đánh</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Participant Roster (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="saas-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users size={16} className="text-slate-900" />
                  <span>Quân số tham gia</span>
                </h2>
                <span className="text-xs text-slate-600">Danh sách các tay vợt trong ca</span>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-slate-900">{session.bookedSlots}</span>
                <span className="text-xs text-slate-500 font-medium">/{session.maxSlots} Slots</span>
              </div>
            </div>

            <div className="space-y-2 lg:max-h-[500px] lg:overflow-y-auto lg:pr-1">
              {session.participants?.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">Chưa có ai đăng ký ca này</div>
              ) : (
                session.participants?.map((p, idx) => {
                  const uid = String(p.userId || p.id)
                  const stats = playerStatsMap[uid] || { totalSets: 0, wins: 0, losses: 0 }
                  const phoneLabel = formatParticipantPhone(p.phone, viewerIsHost)

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl text-xs hover:border-slate-300 transition shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-center font-bold text-slate-600 flex items-center justify-center text-[11px] shrink-0">
                          {idx + 1}
                        </span>
                        <DuckMascot
                          src={p.avatarUrl || '/duck-mascot.png'}
                          size={34}
                          rounded="xl"
                          className="border border-slate-200 shadow-2xs shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 truncate">{p.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                                p.gender === 'FEMALE'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {p.gender === 'FEMALE' ? 'Nữ' : 'Nam'}
                            </span>
                            {p.isGuest ? (
                              <span className="text-[9px] px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded font-bold shrink-0">
                                Vãng lai
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold shrink-0">
                                Cố định
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                stats.totalSets === 0
                                  ? 'bg-slate-50 text-slate-500 border-slate-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              🏸 {stats.totalSets} set ({stats.wins}W - {stats.losses}L)
                            </span>
                            {phoneLabel && (
                              <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">{phoneLabel}</span>
                            )}
                            {p.slotWindow && (
                              <span className="text-[9px] font-extrabold text-slate-900 bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 rounded shrink-0">
                                ⏱️ {p.slotWindow}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end justify-center min-w-[72px]">
                        {p.checkinStatus === 'CHECKED_IN' ? (
                          <span className="inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                            ✓ Đã đến
                          </span>
                        ) : Number(p.depositAmount) > 0 && p.depositStatus !== 'PAID' ? (
                          <span className="inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 animate-pulse whitespace-nowrap">
                            Chờ cọc
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 whitespace-nowrap">
                            Chưa đến
                          </span>
                        )}
                        <span className="block text-[10px] text-slate-600 font-medium mt-1 whitespace-nowrap">
                          {p.paymentStatus === 'PAID'
                            ? 'Đã xong'
                            : `Thu: ${Number(p.remainingAmount).toLocaleString()}đ`}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Member First-Time Deposit VietQR Modal */}
      <BottomSheet
        open={showMemberDepositModal && !!depositQrData}
        onClose={() => {
          setShowMemberDepositModal(false)
          setDepositQrData(null)
        }}
        closeOnBackdrop={false}
        labelledBy="deposit-qr-title"
        bodyClassName="space-y-4 text-center"
        footer={
          <button
            onClick={() => {
              setShowMemberDepositModal(false)
              setDepositQrData(null)
            }}
            className="w-full min-h-11 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm sm:text-xs shadow-sm active:scale-95 transition"
          >
            Dạ vâng, mình đã chuyển khoản cọc rồi! 🏸
          </button>
        }
      >
        {depositQrData && (
          <>
            <DuckMascot size={52} rounded="2xl" className="mx-auto shadow-md border border-slate-200" />
            <div>
              <h3 id="deposit-qr-title" className="font-black text-base text-slate-900">Quét VietQR cọc giữ chỗ (Lần đầu)</h3>
              <p className="text-xs text-slate-600 mt-1">
                Số tiền cọc: <b className="text-rose-600 text-sm font-black">{Number(depositQrData.participant.depositAmount || session?.depositAmount || 20000).toLocaleString()}đ</b>
              </p>
            </div>

            <div className="bg-white p-3 rounded-2xl inline-block shadow-md border border-slate-200">
              <img src={depositQrData.qrUrl} alt="VietQR Deposit" className="w-52 h-52 mx-auto object-contain" />
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs space-y-1.5">
              <div className="flex justify-between gap-2 text-amber-950">
                <span className="font-semibold">Nội dung CK:</span>
                <span className="font-mono font-bold text-slate-950 bg-white px-2 py-0.5 rounded border border-amber-300">
                  COC SF{depositQrData.participant.id}
                </span>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed font-medium pt-1 border-t border-amber-200/80">
                ✨ <b>Host xin cọc 20k cho lần đầu khách iu tham gia nè!</b> 🥰 <br />
                (Số tiền 20k này sẽ được trừ thẳng vào tiền sân khi bạn đến đánh và từ lần thứ 2 trở đi bạn sẽ được <b>MIỄN CỌC 100%</b> nha!)
              </p>
            </div>
          </>
        )}
      </BottomSheet>

      {/* Manual Check-in Modal */}
      <BottomSheet
        open={showCheckinModal}
        onClose={() => {
          setShowCheckinModal(false)
          setCheckinSuccess(false)
        }}
        labelledBy="manual-checkin-title"
        bodyClassName="space-y-4"
        footer={
          checkinSuccess ? (
            <button
              onClick={() => {
                setShowCheckinModal(false)
                setCheckinSuccess(false)
              }}
              className="w-full min-h-11 py-2.5 bg-slate-900 text-white font-bold text-sm sm:text-xs rounded-xl"
            >
              Xác nhận
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setShowCheckinModal(false)}
                className="flex-1 min-h-11 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm sm:text-xs rounded-xl"
              >
                Hủy
              </button>
              <button
                disabled={checkinSubmitting || !checkinTokenInput}
                aria-busy={checkinSubmitting}
                onClick={() => handleCheckinSubmit()}
                className="flex-1 min-h-11 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-xs rounded-xl shadow-sm flex items-center justify-center gap-2"
              >
                {checkinSubmitting && spinner}
                <span>{checkinSubmitting ? 'Đang xác nhận...' : 'Xác nhận'}</span>
              </button>
            </div>
          )
        }
      >
        <div className="text-center px-8">
          <h3 id="manual-checkin-title" className="font-black text-base text-slate-900">Điểm danh 1-Chạm</h3>
          <p className="text-xs text-slate-600 mt-1">
            Nhập hoặc quét mã Token hiển thị trên màn hình Host
          </p>
        </div>

        {checkinSuccess ? (
          <div className="py-4 text-center space-y-3">
            <CheckCircle2 size={44} className="text-emerald-600 mx-auto" />
            <h4 className="font-bold text-sm text-emerald-800">Điểm danh thành công!</h4>
          </div>
        ) : (
          <div className="space-y-3.5">
            {checkinError && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                <AlertCircle size={15} className="shrink-0" />
                <span>{checkinError}</span>
              </div>
            )}

            <div>
              <label htmlFor="checkin-token-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                Mã Token (8 ký tự)
              </label>
              <input
                id="checkin-token-input"
                type="text"
                maxLength={8}
                placeholder="VD: A1B2C3D4"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
                value={checkinTokenInput}
                onChange={(e) => setCheckinTokenInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && checkinTokenInput && !checkinSubmitting) handleCheckinSubmit()
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-lg font-mono font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            {canChooseTwoHoursAtCheckin && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Thời lượng bạn chơi hôm nay
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckinDurationHours(undefined)}
                    className={`min-h-11 py-2 px-2 rounded-xl font-bold text-sm sm:text-xs border transition ${
                      checkinDurationHours === undefined
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    Toàn bộ ca
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckinDurationHours(2.0)}
                    className={`min-h-11 py-2 px-2 rounded-xl font-bold text-sm sm:text-xs border transition ${
                      checkinDurationHours === 2.0
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    Chỉ đánh 2 Tiếng
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Member Time Slot & Duration Selection Modal for >2h Sessions */}
      <BottomSheet
        open={showJoinOptionModal}
        onClose={() => setShowJoinOptionModal(false)}
        labelledBy="join-option-title"
        bodyClassName="space-y-5"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowJoinOptionModal(false)}
              className="flex-1 min-h-11 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm sm:text-xs rounded-xl transition"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={memberJoinMutation.isPending}
              aria-busy={memberJoinMutation.isPending}
              onClick={() => {
                const chosenWindow = subSlotWindows.find((w) => w.key === selectedSlotWindow)
                const slotWindowStr = chosenWindow && chosenWindow.key !== 'FULL'
                  ? `${chosenWindow.timeRange} (${chosenWindow.key === 'EARLY_2H' ? 'Về sớm' : 'Đến muộn'})`
                  : undefined
                memberJoinMutation.mutate({
                  durationHours: selectedDurationHours,
                  slotWindow: slotWindowStr,
                })
              }}
              className="flex-1 min-h-11 py-3 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm sm:text-xs rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2"
            >
              {memberJoinMutation.isPending ? (
                <>
                  {spinner}
                  <span>Đang đăng ký...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Xác nhận đăng ký</span>
                </>
              )}
            </button>
          </div>
        }
      >
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 pr-10">
              <DuckMascot size={40} rounded="xl" className="border border-slate-200 shadow-2xs shrink-0" />
              <div className="min-w-0">
                <h3 id="join-option-title" className="font-black text-base text-slate-950">Chọn Khung Giờ Đánh ({totalSessionHours}h)</h3>
                <p className="text-xs text-slate-500 font-semibold">Tùy chọn đánh trọn ca hoặc chỉ đánh 2 tiếng</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Bạn muốn tham gia vào khung giờ nào?
              </label>

              <div className="space-y-2.5" role="radiogroup" aria-labelledby="join-option-title">
                {subSlotWindows.map((win) => {
                  const isSelected = selectedSlotWindow === win.key
                  const is2h = win.duration === 2.0
                  const isMember = user?.role === 'HOST' || user?.membershipType === 'FIXED'
                  const price = isMember
                    ? (is2h
                        ? (user?.gender === 'FEMALE' ? session.memberFemalePrice2h : session.memberMalePrice2h) || session.memberMalePrice
                        : (user?.gender === 'FEMALE' ? session.memberFemalePrice : session.memberMalePrice))
                    : (is2h
                        ? (user?.gender === 'FEMALE' ? session.guestFemalePrice2h : session.guestMalePrice2h) || session.guestMalePrice
                        : (user?.gender === 'FEMALE' ? session.guestFemalePrice : session.guestMalePrice))

                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      key={win.key}
                      onClick={() => {
                        setSelectedSlotWindow(win.key)
                        setSelectedDurationHours(win.duration === totalSessionHours ? undefined : win.duration)
                      }}
                      className={`w-full text-left p-4 rounded-2xl border-2 cursor-pointer transition-all duration-150 flex items-center justify-between ${
                        isSelected
                          ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/20'
                          : 'border-slate-200 hover:border-slate-400 bg-white text-slate-900 shadow-2xs hover:shadow-sm'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black tracking-tight ${isSelected ? 'text-white' : 'text-slate-950'}`}>
                            {win.label}
                          </span>
                          {win.key === 'FULL' && (
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${isSelected ? 'bg-rose-500 text-white shadow-xs' : 'bg-slate-100 text-slate-700'}`}>
                              Full ca
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-semibold flex items-center gap-1.5 ${isSelected ? 'text-slate-300' : 'text-slate-600'}`}>
                          <span>⏰</span>
                          <span className="font-bold">{win.timeRange}</span>
                        </p>
                      </div>

                      <div className="text-right pl-3">
                        <span className={`text-base font-black block tracking-tight ${isSelected ? 'text-rose-400' : 'text-rose-600'}`}>
                          {Number(price).toLocaleString()}đ
                        </span>
                        <span className={`text-[11px] font-bold ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                          {isMember ? 'Giá Thành viên' : 'Giá Vãng lai'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
      </BottomSheet>

      {/* Camera Scanner */}
      {showCameraScanner && (
        <QrCameraScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowCameraScanner(false)}
          onManualEntry={() => openManualCheckin()}
        />
      )}

      {/* Final Bill QR Modal */}
      <BottomSheet
        open={!!showPaymentQrModal}
        onClose={() => setShowPaymentQrModal(null)}
        title="Quét VietQR thanh toán"
        bodyClassName="space-y-4 text-center"
        footer={
          <button
            onClick={() => setShowPaymentQrModal(null)}
            className="w-full min-h-11 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm sm:text-xs shadow-sm"
          >
            Đã chuyển khoản xong
          </button>
        }
      >
        {showPaymentQrModal && (
          <div className="bg-white p-3 rounded-2xl inline-block border border-slate-200 shadow-sm">
            <img src={showPaymentQrModal} alt="VietQR Final Payment" className="w-52 h-52 mx-auto object-contain" />
          </div>
        )}
        <p className="text-xs text-slate-600">
          Quét mã bằng ứng dụng ngân hàng bất kỳ để thanh toán đúng số tiền.
        </p>
      </BottomSheet>

      {/* Cash Payment Notice Modal */}
      <BottomSheet
        open={showCashNoticeModal}
        onClose={() => setShowCashNoticeModal(false)}
        labelledBy="cash-notice-title"
        bodyClassName="space-y-5 text-center"
        footer={
          <button
            onClick={() => setShowCashNoticeModal(false)}
            className="w-full min-h-11 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm sm:text-xs shadow-md active:scale-95 transition"
          >
            Dạ vâng, mình nhớ rồi ạ! 🥰
          </button>
        }
      >
        <DuckMascot size={56} rounded="2xl" className="mx-auto shadow-md border border-slate-200" />

        <div className="space-y-2">
          <h3 id="cash-notice-title" className="font-black text-base text-slate-900">
            Host đã ghi nhận hình thức Tiền mặt! 💵
          </h3>
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 font-medium leading-relaxed">
            ✨ Host đã nhận được thông tin bạn chọn trả tiền mặt tại sân.
            <p className="mt-1 font-bold text-rose-600">
              💖 Mong khách iu có mặt đúng giờ và hong bùng slot nà! 🏸
            </p>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
