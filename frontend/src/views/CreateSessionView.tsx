import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { DollarSign, Plus, ArrowLeft, Receipt, MapPin } from 'lucide-react'
import { CurrencyInput } from '../components/CurrencyInput'
import { useToast } from '../components/ToastProvider'
import { validateSlotCount } from '../components/host/hostUtils'
import { durationHours, getVnParts, parseServerDateTime, toVnDateTimeInput } from '../lib/dateUtils'

/** "yyyy-MM-ddTHH:mm" (giờ VN) + n giờ → "yyyy-MM-ddTHH:mm" (giờ VN); lỗi → '' */
const addHoursToInput = (value: string, hours: number): string => {
  const d = parseServerDateTime(value)
  if (isNaN(d.getTime())) return ''
  return toVnDateTimeInput(new Date(d.getTime() + hours * 60 * 60 * 1000))
}

const MIN_COURTS = 1
const MAX_COURTS = 10

/** "Sân 1, Sân 2, ..." theo số sân */
const buildCourtNames = (count: number) => Array.from({ length: count }, (_, i) => `Sân ${i + 1}`).join(', ')

const parseCourtNames = (raw: string) =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

const validateCourtCount = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed) return 'Vui lòng nhập số sân.'
  if (!/^\d+$/.test(trimmed)) return 'Số sân chỉ gồm chữ số.'
  const n = Number(trimmed)
  if (n < MIN_COURTS || n > MAX_COURTS) return `Số sân phải từ ${MIN_COURTS} đến ${MAX_COURTS}.`
  return null
}

export const CreateSessionView: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Ô datetime-local chứa giờ "đồng hồ treo tường" Việt Nam (server dùng LocalDateTime giờ VN),
  // nên mọi phép tính giờ đi qua dateUtils để điện thoại khác múi giờ vẫn đúng.
  const getInitialDates = () => {
    const now = new Date()
    // Default to tomorrow 20:00 (giờ VN) to avoid any past time validation issue
    const p = getVnParts(now)
    const tomorrow = new Date(Date.UTC(p.year, p.month - 1, p.day + 1))
    const pad = (n: number) => String(n).padStart(2, '0')
    const startStr = `${tomorrow.getUTCFullYear()}-${pad(tomorrow.getUTCMonth() + 1)}-${pad(tomorrow.getUTCDate())}T20:00`
    const endStr = addHoursToInput(startStr, 2)

    return {
      startStr,
      endStr,
      minStr: toVnDateTimeInput(now),
      minEndStr: endStr,
    }
  }
  const initialDates = React.useMemo(() => getInitialDates(), [])

  const [title, setTitle] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [startTime, setStartTime] = useState(initialDates.startStr)
  const [endTime, setEndTime] = useState(initialDates.endStr)
  const [maxSlotsInput, setMaxSlotsInput] = useState('16')
  const [maxSlotsTouched, setMaxSlotsTouched] = useState(false)
  const [courtCountInput, setCourtCountInput] = useState('2')
  const [courtNames, setCourtNames] = useState(buildCourtNames(2))
  const [courtNamesEdited, setCourtNamesEdited] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
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
  const [costDrinks, setCostDrinks] = useState(30000)

  // Calculate session duration in hours
  const sessionHours = React.useMemo(() => durationHours(startTime, endTime) ?? 2, [startTime, endTime])

  // Helper to compute min EndTime (at least 2h after startTime)
  const minEndTimeStr = React.useMemo(
    () => (startTime ? addHoursToInput(startTime, 2) || initialDates.minStr : initialDates.minStr),
    [startTime, initialDates.minStr]
  )

  const handleStartTimeChange = (newStartStr: string) => {
    setStartTime(newStartStr)
    const s = parseServerDateTime(newStartStr)
    const e = parseServerDateTime(endTime)
    if (isNaN(s.getTime())) return
    // If new duration is less than 2 hours, automatically push end time forward to 2 hours
    if (isNaN(e.getTime()) || e.getTime() - s.getTime() < 2 * 60 * 60 * 1000) {
      setEndTime(addHoursToInput(newStartStr, 2))
    }
  }
  const courtCountError = validateCourtCount(courtCountInput)
  const maxSlotsError = validateSlotCount(maxSlotsInput)
  const courtNameList = parseCourtNames(courtNames)
  const courtNamesError = courtNameList.length === 0 ? 'Vui lòng nhập ít nhất 1 tên sân.' : null
  const courtCount = courtCountError ? 0 : Number(courtCountInput)
  const courtNamesMismatch =
    !courtCountError && !courtNamesError && courtNameList.length !== courtCount
      ? `Đang có ${courtNameList.length} tên sân cho ${courtCount} sân.`
      : null

  const handleCourtCountChange = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, '').slice(0, 2)
    setCourtCountInput(digits)
    if (validateCourtCount(digits)) return
    const n = Number(digits)
    // Tự sinh tên sân & gợi ý số slot cho tới khi Host tự sửa tay
    if (!courtNamesEdited) setCourtNames(buildCourtNames(n))
    if (!maxSlotsTouched) setMaxSlotsInput(String(Math.min(60, n * 8)))
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (sessionHours < 2) {
        throw new Error('Thời lượng ca đánh phải tối thiểu 2 tiếng (120 phút)!')
      }
      const formatToFullIso = (val: string) => {
        if (!val) return val
        return val.length === 16 ? `${val}:00` : val
      }

      const res = await api.post('/sessions', {
        title,
        venueName: venueName.trim(),
        venueAddress: venueAddress.trim(),
        startTime: formatToFullIso(startTime),
        endTime: formatToFullIso(endTime),
        maxSlots: Number(maxSlotsInput),
        courtCount,
        courtNames: courtNameList.join(', '),
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
        costDrinks,
      })
      return res.data
    },
    onSuccess: (data) => {
      showToast('Tạo ca đánh thành công!', 'success')
      navigate(`/host/session/${data.id}`)
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || err.message || 'Không thể tạo ca đánh!', 'error')
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
            <p className="text-xs text-slate-600 font-medium">Cấu hình thời gian, ma trận giá slot động và chi phí ca sân</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSubmitAttempted(true)
            const firstError = courtCountError || courtNamesError || courtNamesMismatch || maxSlotsError
            if (firstError) {
              showToast(firstError, 'error')
              return
            }
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
                <label htmlFor="create-court-count" className="block font-bold text-slate-700 mb-1.5">
                  Số sân
                </label>
                <input
                  id="create-court-count"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={courtCountInput}
                  onChange={(e) => handleCourtCountChange(e.target.value)}
                  aria-invalid={!!courtCountError}
                  aria-describedby={courtCountError ? 'create-court-count-error' : undefined}
                  className={`w-full bg-white border rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none shadow-sm ${
                    courtCountError ? 'border-rose-500 focus:border-rose-600' : 'border-slate-200 focus:border-slate-900'
                  }`}
                />
                {courtCountError && (
                  <p id="create-court-count-error" role="alert" className="mt-1 text-[11px] font-bold text-rose-600">
                    {courtCountError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="create-court-names" className="block font-bold text-slate-700 mb-1.5">
                  Tên sân (ngăn cách bằng dấu phẩy)
                </label>
                <input
                  id="create-court-names"
                  type="text"
                  placeholder="VD: Sân 1, Sân 2"
                  value={courtNames}
                  onChange={(e) => {
                    setCourtNames(e.target.value)
                    setCourtNamesEdited(true)
                  }}
                  aria-invalid={!!(courtNamesError || courtNamesMismatch)}
                  className={`w-full bg-white border rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none shadow-sm ${
                    (submitAttempted && courtNamesError) || courtNamesMismatch
                      ? 'border-amber-500 focus:border-amber-600'
                      : 'border-slate-200 focus:border-slate-900'
                  }`}
                />
                {((submitAttempted && courtNamesError) || courtNamesMismatch) && (
                  <p role="alert" className="mt-1 text-[11px] font-bold text-amber-700">
                    {courtNamesError || courtNamesMismatch}
                  </p>
                )}
                {courtNamesEdited && !courtCountError && (
                  <button
                    type="button"
                    onClick={() => {
                      setCourtNames(buildCourtNames(courtCount))
                      setCourtNamesEdited(false)
                    }}
                    className="mt-1 min-h-9 text-[11px] font-bold text-slate-700 underline"
                  >
                    Đặt lại theo số sân
                  </button>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="create-max-slots" className="block font-bold text-slate-700 mb-1.5">
                Số lượng Slot tối đa
              </label>
              <input
                id="create-max-slots"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={maxSlotsInput}
                onChange={(e) => {
                  setMaxSlotsInput(e.target.value.replace(/[^\d]/g, '').slice(0, 3))
                  setMaxSlotsTouched(true)
                }}
                aria-invalid={!!maxSlotsError}
                aria-describedby="create-max-slots-hint"
                className={`w-full sm:w-1/3 bg-white border rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none shadow-sm ${
                  maxSlotsError ? 'border-rose-500 focus:border-rose-600' : 'border-slate-200 focus:border-slate-900'
                }`}
              />
              <p
                id="create-max-slots-hint"
                role={maxSlotsError ? 'alert' : undefined}
                className={`mt-1 text-[11px] font-bold ${maxSlotsError ? 'text-rose-600' : 'text-slate-500'}`}
              >
                {maxSlotsError ??
                  (maxSlotsTouched ? 'Gợi ý: 8 người mỗi sân.' : `Tự gợi ý ${courtCount || 0} sân × 8 người.`)}
              </p>
            </div>
          </div>

          {/* Pricing Matrix Setup */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <DollarSign size={15} className="text-rose-600" />
                <span>Ma trận giá slot & Tiền cọc giữ chỗ</span>
              </h3>
              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-slate-900 text-white shadow-xs w-fit">
                ⏱️ Khung ca: {sessionHours} Giờ ({sessionHours === 2 ? 'Ca chuẩn 2 Tiếng' : sessionHours === 3 ? 'Ca kéo dài 3 Tiếng' : `Ca ${sessionHours} Tiếng`})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Slot Nam cố định ({sessionHours}h)
                </label>
                <CurrencyInput
                  value={memberMalePrice}
                  onChange={setMemberMalePrice}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Slot Nữ cố định ({sessionHours}h - Trợ giá)
                </label>
                <CurrencyInput
                  value={memberFemalePrice}
                  onChange={setMemberFemalePrice}
                  className="text-rose-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Slot Nam vãng lai ({sessionHours}h)
                </label>
                <CurrencyInput
                  value={guestMalePrice}
                  onChange={setGuestMalePrice}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Slot Nữ vãng lai ({sessionHours}h - Trợ giá)
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
                  <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                    <span>Giá slot tùy chọn chỉ đánh 2 Tiếng (Cho người về sớm / không đánh hết ca {sessionHours}h):</span>
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded border border-slate-200">
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
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Cố định Nữ (2h)
                    </label>
                    <CurrencyInput
                      value={memberFemalePrice2h}
                      onChange={setMemberFemalePrice2h}
                      className="text-rose-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Vãng lai Nam (2h)
                    </label>
                    <CurrencyInput
                      value={guestMalePrice2h}
                      onChange={setGuestMalePrice2h}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Vãng lai Nữ (2h)
                    </label>
                    <CurrencyInput
                      value={guestFemalePrice2h}
                      onChange={setGuestFemalePrice2h}
                      className="text-rose-600"
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tiền trà đá / nước uống (VNĐ)</label>
                <CurrencyInput
                  value={costDrinks}
                  onChange={setCostDrinks}
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
