import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { DollarSign, Plus, ArrowLeft, Receipt, MapPin } from 'lucide-react'
import { CurrencyInput } from '../components/CurrencyInput'

export const CreateSessionView: React.FC = () => {
  const navigate = useNavigate()

  const getInitialDates = () => {
    const now = new Date()
    const start = new Date(now)
    start.setHours(20, 0, 0, 0)
    if (now.getHours() >= 20) {
      start.setDate(start.getDate() + 1)
    }
    const end = new Date(start)
    end.setHours(start.getHours() + 2)

    const pad = (n: number) => String(n).padStart(2, '0')
    const formatForInput = (d: Date) => {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    return {
      startStr: formatForInput(start),
      endStr: formatForInput(end),
      minStr: formatForInput(now),
      minEndStr: formatForInput(end),
    }
  }

  const initialDates = React.useMemo(() => getInitialDates(), [])

  const [title, setTitle] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [startTime, setStartTime] = useState(initialDates.startStr)
  const [endTime, setEndTime] = useState(initialDates.endStr)
  const [maxSlots, setMaxSlots] = useState(8)
  const [courtCount, setCourtCount] = useState(2)
  const [courtNames, setCourtNames] = useState('Sân 1, Sân 2')
  const [memberMalePrice, setMemberMalePrice] = useState(50000)
  const [memberFemalePrice, setMemberFemalePrice] = useState(40000)
  const [guestMalePrice, setGuestMalePrice] = useState(60000)
  const [guestFemalePrice, setGuestFemalePrice] = useState(50000)

  // Optional 2h partial price for 3h/4h sessions
  const [memberMalePrice2h, setMemberMalePrice2h] = useState(40000)
  const [memberFemalePrice2h, setMemberFemalePrice2h] = useState(30000)
  const [guestMalePrice2h, setGuestMalePrice2h] = useState(50000)
  const [guestFemalePrice2h, setGuestFemalePrice2h] = useState(40000)

  const [depositAmount, setDepositAmount] = useState(20000)
  const [costCourt, setCostCourt] = useState(200000)
  const [costShuttlecock, setCostShuttlecock] = useState(80000)

  // Calculate session duration in hours
  const sessionHours = React.useMemo(() => {
    try {
      const start = new Date(startTime).getTime()
      const end = new Date(endTime).getTime()
      if (start && end && end > start) {
        const diffHours = (end - start) / (1000 * 60 * 60)
        return Math.round(diffHours * 10) / 10
      }
    } catch (_) {}
    return 2
  }, [startTime, endTime])

  // Helper to compute min EndTime (at least 2h after startTime)
  const minEndTimeStr = React.useMemo(() => {
    try {
      if (startTime) {
        const s = new Date(startTime)
        s.setHours(s.getHours() + 2)
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}T${pad(s.getHours())}:${pad(s.getMinutes())}`
      }
    } catch (_) {}
    return initialDates.minStr
  }, [startTime, initialDates.minStr])

  const handleStartTimeChange = (newStartStr: string) => {
    setStartTime(newStartStr)
    try {
      const s = new Date(newStartStr)
      const e = new Date(endTime)
      // If new duration is less than 2 hours, automatically push end time forward to 2 hours
      if (isNaN(e.getTime()) || (e.getTime() - s.getTime()) < 2 * 60 * 60 * 1000) {
        const autoEnd = new Date(s)
        autoEnd.setHours(autoEnd.getHours() + 2)
        const pad = (n: number) => String(n).padStart(2, '0')
        setEndTime(`${autoEnd.getFullYear()}-${pad(autoEnd.getMonth() + 1)}-${pad(autoEnd.getDate())}T${pad(autoEnd.getHours())}:${pad(autoEnd.getMinutes())}`)
      }
    } catch (_) {}
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (sessionHours < 2) {
        throw new Error('Thời lượng ca đánh phải tối thiểu 2 tiếng (120 phút)!')
      }
      const res = await api.post('/sessions', {
        title,
        venueName: venueName.trim(),
        venueAddress: venueAddress.trim(),
        startTime,
        endTime,
        maxSlots,
        courtCount,
        courtNames,
        memberMalePrice,
        memberFemalePrice,
        guestMalePrice,
        guestFemalePrice,
        memberMalePrice2h: sessionHours > 2 ? memberMalePrice2h : undefined,
        memberFemalePrice2h: sessionHours > 2 ? memberFemalePrice2h : undefined,
        guestMalePrice2h: sessionHours > 2 ? guestMalePrice2h : undefined,
        guestFemalePrice2h: sessionHours > 2 ? guestFemalePrice2h : undefined,
        depositAmount,
        costCourt,
        costShuttlecock,
      })
      return res.data
    },
    onSuccess: (data) => {
      alert('Tạo ca đánh thành công!')
      navigate(`/host/session/${data.id}`)
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Không thể tạo ca đánh!')
    },
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-950 transition bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-sm"
        >
          <ArrowLeft size={15} />
          <span>Quay lại trang chủ</span>
        </button>
      </div>

      <div className="saas-card rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3.5 pb-5 border-b border-slate-200">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold shadow-sm">
            <Plus size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">Thiết lập ca đánh mới</h1>
            <p className="text-xs text-slate-600 font-medium">Cấu hình thời gian, ma trận giá vé động và chi phí ca sân</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
          className="space-y-6 text-xs"
        >
          {/* General Section */}
          <div className="space-y-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 text-xs">Tiêu đề ca đánh</label>
              <input
                type="text"
                required
                placeholder="Nhập tiêu đề ca đánh (VD: Ca Giao Lưu Chiều T7, Kèo Đánh Đôi...)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 font-semibold text-sm focus:border-slate-900 focus:outline-none shadow-sm"
              />
            </div>

            {/* Custom Venue Name & Address Input */}
            <div className="p-4.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <MapPin size={15} className="text-rose-600" />
                <span>Địa điểm sân thi đấu & Check-in GPS</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1 text-[11px]">Tên sân thi đấu</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tên sân (VD: Sân Cầu Lông Đại Phát, Sân Kỳ Hòa...)"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:border-slate-900 focus:outline-none shadow-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1 text-[11px]">Địa chỉ chi tiết</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập địa chỉ (VD: 313/17 Phan Huy Ích, P.14, Gò Vấp...)"
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-semibold focus:border-slate-900 focus:outline-none shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Giờ bắt đầu</label>
                <input
                  type="datetime-local"
                  required
                  min={initialDates.minStr}
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:border-slate-900 focus:outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Giờ kết thúc</span>
                  <span className="text-[10px] text-indigo-700 font-bold">Tối thiểu 2h</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  min={minEndTimeStr}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:border-slate-900 focus:outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Số sân bao quát</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={courtCount}
                  onChange={(e) => setCourtCount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:border-slate-900 focus:outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Tên / Số sân chỉ định</label>
                <input
                  type="text"
                  placeholder="VD: Sân 1, Sân 2"
                  value={courtNames}
                  onChange={(e) => setCourtNames(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:border-slate-900 focus:outline-none shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Số lượng Slot tối đa</label>
              <input
                type="number"
                min={2}
                max={40}
                value={maxSlots}
                onChange={(e) => setMaxSlots(Number(e.target.value))}
                className="w-full sm:w-1/3 bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:border-slate-900 focus:outline-none shadow-sm"
              />
            </div>
          </div>

          {/* Pricing Matrix Setup */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <DollarSign size={15} className="text-rose-600" />
                <span>Ma trận giá vé & Tiền cọc 30%</span>
              </h3>
              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-slate-900 text-white shadow-xs w-fit">
                ⏱️ Khung ca: {sessionHours} Giờ ({sessionHours === 2 ? 'Ca chuẩn 2 Tiếng' : sessionHours === 3 ? 'Ca kéo dài 3 Tiếng' : `Ca ${sessionHours} Tiếng`})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Vé Nam cố định ({sessionHours}h)
                </label>
                <CurrencyInput
                  value={memberMalePrice}
                  onChange={setMemberMalePrice}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Vé Nữ cố định ({sessionHours}h - Trợ giá)
                </label>
                <CurrencyInput
                  value={memberFemalePrice}
                  onChange={setMemberFemalePrice}
                  className="text-rose-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Vé Nam vãng lai ({sessionHours}h)
                </label>
                <CurrencyInput
                  value={guestMalePrice}
                  onChange={setGuestMalePrice}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Vé Nữ vãng lai ({sessionHours}h - Trợ giá)
                </label>
                <CurrencyInput
                  value={guestFemalePrice}
                  onChange={setGuestFemalePrice}
                  className="text-rose-600"
                />
              </div>
            </div>

            {/* If session is > 2h, show 2h partial slot options */}
            {sessionHours > 2 && (
              <div className="pt-3 border-t border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">
                    ⚡ Giá vé tùy chọn chỉ đánh 2 Tiếng (Cho người về sớm / không đánh hết ca {sessionHours}h):
                  </span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-800 font-bold px-2 py-0.5 rounded border border-indigo-200">
                    Slot 2h Linh Hoạt
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Cố định Nam (2h)
                    </label>
                    <CurrencyInput
                      value={memberMalePrice2h}
                      onChange={setMemberMalePrice2h}
                      className="border-indigo-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Cố định Nữ (2h)
                    </label>
                    <CurrencyInput
                      value={memberFemalePrice2h}
                      onChange={setMemberFemalePrice2h}
                      className="border-indigo-200 text-rose-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Vãng lai Nam (2h)
                    </label>
                    <CurrencyInput
                      value={guestMalePrice2h}
                      onChange={setGuestMalePrice2h}
                      className="border-indigo-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Vãng lai Nữ (2h)
                    </label>
                    <CurrencyInput
                      value={guestFemalePrice2h}
                      onChange={setGuestFemalePrice2h}
                      className="border-indigo-200 text-rose-600"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Tiền cọc giữ chỗ vãng lai VietQR (VNĐ)
              </label>
              <div className="w-full sm:w-1/2">
                <CurrencyInput
                  value={depositAmount}
                  onChange={setDepositAmount}
                />
              </div>
            </div>
          </div>

          {/* Cost Estimates */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <Receipt size={15} className="text-slate-900" />
              <span>Dự toán chi phí ca (Hạch toán lãi ròng tự động)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tiền thuê sân (VNĐ)</label>
                <CurrencyInput
                  value={costCourt}
                  onChange={setCostCourt}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tiền cầu dự kiến (VNĐ)</label>
                <CurrencyInput
                  value={costShuttlecock}
                  onChange={setCostShuttlecock}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 font-bold text-white rounded-xl text-xs shadow-md transition active:scale-95 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Đang tạo ca...' : 'Tạo ca đánh & Mở đăng ký ngay'}
          </button>
        </form>
      </div>
    </div>
  )
}
