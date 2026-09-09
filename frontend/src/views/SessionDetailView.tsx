import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { SessionItem, Participant } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { QrCameraScanner } from '../components/QrCameraScanner'
import { DuckMascot } from '../components/DuckMascot'
import { useToast } from '../components/ToastProvider'
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
  X,
} from 'lucide-react'

export const SessionDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>()
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

  // Checkin states
  const [checkinTokenInput, setCheckinTokenInput] = useState('')
  const [checkinDurationHours, setCheckinDurationHours] = useState<number | undefined>(undefined)
  const [checkinError, setCheckinError] = useState('')
  const [checkinSuccess, setCheckinSuccess] = useState(false)
  const [locatingGps, setLocatingGps] = useState(false)

  const { data: session, isLoading } = useQuery<SessionItem>({
    queryKey: ['session', id],
    queryFn: async () => {
      const res = await api.get(`/sessions/${id}`)
      return res.data
    },
    refetchInterval: 3000,
  })

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
    mutationFn: async (opts?: { durationHours?: number }) => {
      const res = await api.post(`/sessions/${id}/join`, {
        durationHours: opts?.durationHours,
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
      showToast(err.response?.data?.message || 'Không thể tham gia ca!', 'error')
    },
  })

  // GPS & Dynamic Token Checkin
  const handleCheckinSubmit = (tokenToUse?: string) => {
    const tokenVal = (tokenToUse || checkinTokenInput).trim().toUpperCase()
    setCheckinError('')
    if (!tokenVal) {
      setCheckinError('Vui lòng nhập hoặc quét mã Token điểm danh!')
      return
    }

    if (!navigator.geolocation) {
      setCheckinError('Trình duyệt không hỗ trợ định vị GPS!')
      return
    }

    setLocatingGps(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.post(`/sessions/${id}/checkin`, {
            token: tokenVal,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            durationHours: checkinDurationHours,
          })
          setLocatingGps(false)
          setCheckinSuccess(true)
          queryClient.invalidateQueries({ queryKey: ['session', id] })
        } catch (err: any) {
          setLocatingGps(false)
          setCheckinError(err.response?.data?.message || 'Điểm danh thất bại!')
        }
      },
      () => {
        setLocatingGps(false)
        setCheckinError('Không thể lấy vị trí GPS (vui lòng cho phép quyền truy cập vị trí)!')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Handle Scan QR from Camera
  const handleScanSuccess = (scannedText: string) => {
    setShowCameraScanner(false)
    setCheckinTokenInput(scannedText)
    handleCheckinSubmit(scannedText)
  }

  const handleOpenFinalPaymentQr = async (participantId: number) => {
    try {
      // Auto register intent as VietQR
      await api.post(`/sessions/participants/${participantId}/select-payment-method`, {
        paymentMethod: 'VIETQR'
      }).catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      const res = await api.get(`/sessions/participants/${participantId}/payment-qr`)
      if (res.data?.qrUrl) {
        setShowPaymentQrModal(res.data.qrUrl)
      } else {
        showToast('Không thể tạo mã QR thanh toán!', 'error')
      }
    } catch (err: any) {
      console.error('QR Payment Error:', err)
      showToast(err.response?.data?.message || 'Không thể tạo mã QR thanh toán! Vui lòng kiểm tra lại kết nối Backend.', 'error')
    }
  }

  const handleSelectCashPayment = async (participantId: number) => {
    try {
      await api.post(`/sessions/participants/${participantId}/select-payment-method`, {
        paymentMethod: 'CASH'
      }).catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      setShowCashNoticeModal(true)
    } catch (err) {
      setShowCashNoticeModal(true)
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

  // Find user participant info (Strictly match logged-in user)
  const isUserParticipant = session.participants?.find((p) => user?.id && p.userId === user.id)
  const isPendingDeposit = isUserParticipant && Number(isUserParticipant.depositAmount) > 0 && isUserParticipant.depositStatus !== 'PAID'
  const isCheckedIn = isUserParticipant?.checkinStatus === 'CHECKED_IN'
  const isFull = session.bookedSlots >= session.maxSlots

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-sm"
        >
          <ArrowLeft size={15} />
          <span>Quay lại danh sách ca</span>
        </button>

        {user?.role === 'HOST' && (
          <button
            onClick={() => navigate(`/host/session/${session.id}`)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <Shield size={15} />
            <span>Mở Host Panel</span>
          </button>
        )}
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Session Info & Pricing Card (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="saas-card rounded-3xl p-8 space-y-6 relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                  {session.status === 'ACTIVE'
                    ? '• Đang diễn ra'
                    : session.status === 'UPCOMING'
                    ? 'Sắp diễn ra'
                    : 'Đã kết thúc'}
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

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
              {session.title}
            </h1>

            {/* Venue & Time Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                  <MapPin size={15} />
                  <span>Địa điểm thi đấu</span>
                </div>
                <p className="text-slate-900 font-bold text-sm mt-1">{session.venueName}</p>
                <p className="text-slate-600 text-[11px] leading-relaxed font-medium">{session.venueAddress}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                  <Clock size={15} className="text-rose-600" />
                  <span>Khung giờ ca đánh</span>
                </div>
                <p className="text-slate-900 font-bold text-sm mt-1">
                  {new Date(session.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} -{' '}
                  {new Date(session.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-slate-600 text-[11px] font-medium">
                  {new Date(session.startTime).toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                  })}
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

              {session.status === 'COMPLETED' || new Date().getTime() > new Date(session.endTime).getTime() ? (
                <div className="w-full py-3.5 bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-xl text-center flex items-center justify-center gap-2 text-xs shadow-sm">
                  <span>Ca đánh này đã kết thúc (Đã đóng đăng ký)</span>
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
                      Sau khi Host xác nhận đã nhận cọc, bạn sẽ được tự động mở đầy đủ chức năng Điểm danh GPS và Thanh toán tại sân.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                    <button
                      onClick={async () => {
                        try {
                          const qrRes = await api.get(`/sessions/participants/${isUserParticipant.id}/deposit-qr`)
                          setDepositQrData({ qrUrl: qrRes.data.qrUrl, participant: isUserParticipant })
                          setShowMemberDepositModal(true)
                        } catch (e) {
                          showToast('Không thể tạo mã VietQR cọc!', 'error')
                        }
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
                    >
                      <QrCode size={15} />
                      <span>Xem lại mã VietQR Cọc 20.000đ</span>
                    </button>
                  </div>
                </div>
              ) : isUserParticipant ? (
                <div className="space-y-3">
                  {/* Trạng thái điểm danh & nút checkin nếu chưa đến */}
                  {isCheckedIn ? (
                    <div className="w-full py-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-xl text-center flex items-center justify-center gap-2 text-sm shadow-sm">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      <span>Đã điểm danh lúc {new Date(isUserParticipant.checkinAt!).toLocaleTimeString()}</span>
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
                          className="py-3 bg-slate-900 hover:bg-slate-800 font-bold text-white rounded-xl flex items-center justify-center gap-2 text-xs transition active:scale-95 shadow-sm"
                        >
                          <Camera size={16} />
                          <span>Quét QR sân (Camera)</span>
                        </button>

                        <button
                          onClick={() => setShowCheckinModal(true)}
                          className="py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition border border-slate-200 active:scale-95 shadow-sm"
                        >
                          <QrCode size={16} />
                          <span>Nhập mã Token GPS</span>
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

                      {/* Chi tiết khấu trừ cọc nếu có */}
                      <div className="text-[11px] text-amber-900 space-y-1 bg-amber-100/60 p-2.5 rounded-xl">
                        <div className="flex justify-between">
                          <span>• Giá slot ca đánh:</span>
                          <span className="font-semibold">{Number(isUserParticipant.finalFee).toLocaleString('vi-VN')}đ</span>
                        </div>
                        {Number(isUserParticipant.depositAmount) > 0 && (
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
                          className={`py-2.5 font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm ${
                            isUserParticipant.paymentMethod === 'VIETQR'
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-400'
                              : 'bg-slate-950 hover:bg-slate-800 text-white'
                          }`}
                        >
                          <QrCode size={15} />
                          <span>Quét VietQR chuyển khoản</span>
                        </button>

                        <button
                          onClick={() => handleSelectCashPayment(isUserParticipant.id)}
                          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center text-center transition border ${
                            isUserParticipant.paymentMethod === 'CASH'
                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300'
                              : 'bg-white hover:bg-slate-50 border-amber-300 text-amber-950 shadow-2xs'
                          }`}
                        >
                          <span>💵 Trả Tiền mặt cho Host</span>
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

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {session.participants?.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">Chưa có ai đăng ký ca này</div>
              ) : (
                session.participants?.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl text-xs hover:border-slate-300 transition shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-center font-bold text-slate-600 flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </span>
                      <DuckMascot
                        src={p.avatarUrl || '/duck-mascot.png'}
                        size={32}
                        rounded="xl"
                        className="border border-slate-200 shadow-2xs"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{p.name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                              p.gender === 'FEMALE'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {p.gender === 'FEMALE' ? 'Nữ' : 'Nam'}
                          </span>
                          {p.isGuest ? (
                            <span className="text-[9px] px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded font-bold">
                              Vãng lai
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold">
                              Cố định
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">{user?.role === 'HOST' ? p.phone : p.phone.slice(0, 4) + '***' + p.phone.slice(-3)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      {p.checkinStatus === 'CHECKED_IN' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          ✓ Đã đến
                        </span>
                      ) : Number(p.depositAmount) > 0 && p.depositStatus !== 'PAID' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                          Chờ duyệt cọc
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                          Chưa đến
                        </span>
                      )}
                      <span className="block text-[10px] text-slate-600 font-medium mt-1">
                        {p.paymentStatus === 'PAID'
                          ? 'Đã xong'
                          : `Thu: ${Number(p.remainingAmount).toLocaleString()}đ`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Member First-Time Deposit VietQR Modal */}
      {showMemberDepositModal && depositQrData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-7 space-y-4 shadow-2xl text-center">
            <DuckMascot size={52} rounded="2xl" className="mx-auto shadow-md border border-slate-200" />
            <div>
              <h3 className="font-black text-base text-slate-900">Quét VietQR cọc giữ chỗ (Lần đầu)</h3>
              <p className="text-xs text-slate-600 mt-1">
                Số tiền cọc: <b className="text-rose-600 text-sm font-black">{Number(depositQrData.participant.depositAmount || session?.depositAmount || 20000).toLocaleString()}đ</b>
              </p>
            </div>

            <div className="bg-white p-3 rounded-2xl inline-block shadow-md border border-slate-200">
              <img src={depositQrData.qrUrl} alt="VietQR Deposit" className="w-52 h-52 mx-auto object-contain" />
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs space-y-1.5">
              <div className="flex justify-between text-amber-950">
                <span className="font-semibold">Nội dung CK:</span>
                <span className="font-mono font-bold text-slate-950 bg-white px-2 py-0.5 rounded border border-amber-300">
                  COC {session?.id} {depositQrData.participant.phone}
                </span>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed font-medium pt-1 border-t border-amber-200/80">
                ✨ <b>Host xin cọc 20k cho lần đầu khách iu tham gia nè!</b> 🥰 <br />
                (Số tiền 20k này sẽ được trừ thẳng vào tiền sân khi bạn đến đánh và từ lần thứ 2 trở đi bạn sẽ được <b>MIỄN CỌC 100%</b> nha!)
              </p>
            </div>

            <button
              onClick={() => {
                setShowMemberDepositModal(false)
                setDepositQrData(null)
              }}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-sm active:scale-95 transition"
            >
              Dạ vâng, mình đã chuyển khoản cọc rồi! 🏸
            </button>
          </div>
        </div>
      )}

      {/* Manual Check-in Modal */}
      {showCheckinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="text-center">
              <h3 className="font-black text-base text-slate-900">Điểm danh GPS 1-Chạm</h3>
              <p className="text-xs text-slate-600 mt-1">
                Nhập mã Token hiển thị trên màn hình Host (Bán kính &le; 150m)
              </p>
            </div>

            {checkinSuccess ? (
              <div className="py-4 text-center space-y-3">
                <CheckCircle2 size={44} className="text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-emerald-800">Điểm danh thành công!</h4>
                <button
                  onClick={() => {
                    setShowCheckinModal(false)
                    setCheckinSuccess(false)
                  }}
                  className="mt-3 px-6 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
                >
                  Xác nhận
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {checkinError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{checkinError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Mã Token (8 ký tự)
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="VD: A1B2C3D4"
                    value={checkinTokenInput}
                    onChange={(e) => setCheckinTokenInput(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-lg font-mono font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                {session.memberMalePrice2h && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Thời lượng bạn chơi hôm nay
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCheckinDurationHours(undefined)}
                        className={`py-2 px-2 rounded-xl font-bold text-xs border transition ${
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
                        className={`py-2 px-2 rounded-xl font-bold text-xs border transition ${
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

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCheckinModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Hủy
                  </button>
                  <button
                    disabled={locatingGps || !checkinTokenInput}
                    onClick={() => handleCheckinSubmit()}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm"
                  >
                    {locatingGps ? 'Đang dò GPS...' : 'Xác nhận'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Member Time Slot & Duration Selection Modal for >2h Sessions */}
      {showJoinOptionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <DuckMascot size={36} rounded="xl" className="border border-slate-200 shadow-2xs" />
                <div>
                  <h3 className="font-black text-sm text-slate-900">Chọn Khung Giờ Đánh ({totalSessionHours}h)</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">Tùy chọn đánh trọn ca hoặc chỉ đánh 2 tiếng</p>
                </div>
              </div>
              <button
                onClick={() => setShowJoinOptionModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Bạn muốn tham gia vào khung giờ nào?
              </label>

              <div className="space-y-2">
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
                    <div
                      key={win.key}
                      onClick={() => {
                        setSelectedSlotWindow(win.key)
                        setSelectedDurationHours(win.duration === totalSessionHours ? undefined : win.duration)
                      }}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'border-slate-950 bg-slate-900 text-white shadow-md'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-900'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {win.label}
                          </span>
                          {win.key === 'FULL' && (
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isSelected ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
                              Full ca
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-mono font-bold ${isSelected ? 'text-slate-300' : 'text-slate-600'}`}>
                          ⏰ {win.timeRange}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className={`text-sm font-black block font-mono ${isSelected ? 'text-rose-300' : 'text-rose-600'}`}>
                          {Number(price).toLocaleString()}đ
                        </span>
                        <span className={`text-[10px] font-semibold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {isMember ? 'Giá Thành viên' : 'Giá Vãng lai'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowJoinOptionModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={memberJoinMutation.isPending}
                onClick={() => {
                  memberJoinMutation.mutate({ durationHours: selectedDurationHours })
                }}
                className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2"
              >
                {memberJoinMutation.isPending ? (
                  <span>Đang đăng ký...</span>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Xác nhận đăng ký</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Scanner */}
      {showCameraScanner && (
        <QrCameraScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {/* Final Bill QR Modal */}
      {showPaymentQrModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 text-center shadow-2xl">
            <h3 className="font-black text-base text-slate-900">Quét VietQR thanh toán</h3>
            <div className="bg-white p-3 rounded-2xl inline-block border border-slate-200 shadow-sm">
              <img src={showPaymentQrModal} alt="VietQR Final Payment" className="w-52 h-52 mx-auto object-contain" />
            </div>
            <p className="text-xs text-slate-600">
              Quét mã bằng ứng dụng ngân hàng bất kỳ để thanh toán đúng số tiền.
            </p>
            <button
              onClick={() => setShowPaymentQrModal(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-sm"
            >
              Đã chuyển khoản xong
            </button>
          </div>
        </div>
      )}

      {/* Cash Payment Notice Modal */}
      {showCashNoticeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <DuckMascot size={56} rounded="2xl" className="mx-auto shadow-md border border-slate-200" />

            <div className="space-y-2">
              <h3 className="font-black text-base text-slate-900">
                Host đã ghi nhận hình thức Tiền mặt! 💵
              </h3>
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 font-medium leading-relaxed">
                ✨ Host đã nhận được thông tin bạn chọn trả tiền mặt tại sân.
                <p className="mt-1 font-bold text-rose-600">
                  💖 Mong khách iu có mặt đúng giờ và hong bùng slot nà! 🏸
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCashNoticeModal(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md active:scale-95 transition"
            >
              Dạ vâng, mình nhớ rồi ạ! 🥰
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
