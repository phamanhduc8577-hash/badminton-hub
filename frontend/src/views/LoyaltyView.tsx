import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { LoyaltyReward, AttendanceRecord } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
import { GiftGraphic } from '../components/GiftGraphic'
import { BottomSheet } from '../components/BottomSheet'
import { formatVnTime, getVnParts, vnDateKey } from '../lib/dateUtils'
import {
  Gift,
  ChevronLeft,
  ChevronRight,
  Lock,
  Check,
  MapPin,
  Sparkles,
  Calendar as CalendarIcon,
} from 'lucide-react'

/** Ngày 1 của tháng hiện tại theo giờ Việt Nam */
const vnMonthStart = () => {
  const p = getVnParts(new Date())
  return new Date(p.year, p.month - 1, 1)
}

const monthNamesVi = [
  'Tháng Một',
  'Tháng Hai',
  'Tháng Ba',
  'Tháng Tư',
  'Tháng Năm',
  'Tháng Sáu',
  'Tháng Bảy',
  'Tháng Tám',
  'Tháng Chín',
  'Tháng Mười',
  'Tháng Mười Một',
  'Tháng Mười Hai',
]

export const LoyaltyView: React.FC = () => {
  const { user, setAuth, token } = useAuthStore()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'REWARDS' | 'CALENDAR'>('REWARDS')
  const [currentDate, setCurrentDate] = useState(vnMonthStart)

  // Trạng thái Popup nổ quà 3D
  const [unboxingMilestone, setUnboxingMilestone] = useState<{
    target: number
    gift: string
    desc: string
    type: string
    isClaimed: boolean
  } | null>(null)

  const [isRevealed, setIsRevealed] = useState(false)

  // Chi tiết ngày trên lịch
  const [selectedDay, setSelectedDay] = useState<{ label: string; records: AttendanceRecord[] } | null>(null)

  // Đồng bộ profile
  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/auth/me')
      if (res.data && token) {
        setAuth(res.data, token)
      }
      return res.data
    },
    enabled: !!user && !!token,
    staleTime: 30_000,
  })

  // Danh sách quà
  const { data: rewards } = useQuery<LoyaltyReward[]>({
    queryKey: ['loyalty-rewards'],
    queryFn: async () => {
      const res = await api.get('/loyalty/my-rewards')
      return res.data
    },
    enabled: !!user,
    staleTime: 30_000,
  })

  // Lịch sử điểm danh
  const { data: history } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-history'],
    queryFn: async () => {
      const res = await api.get('/loyalty/attendance-history')
      return res.data
    },
    enabled: !!user,
    staleTime: 30_000,
  })

  const attended = profile?.sessionsAttended ?? user?.sessionsAttended ?? 0

  const milestones = [
    { target: 5, gift: '1 Chai nước tăng lực Revive', desc: 'Bù khoáng & năng lượng tức thì sau set đấu kịch tính', type: 'REVIVE' },
    { target: 10, gift: 'Voucher giảm 15% tiền slot', desc: 'Trừ trực tiếp vào hóa đơn ca đánh tiếp theo của CLB', type: 'DISCOUNT_15' },
    { target: 20, gift: '1 Quấn cán vợt cao cấp', desc: 'Quấn cán vợt cầu lông êm ái, bám tay chống trơn trượt', type: 'GRIP_1' },
    { target: 25, gift: '2 Quấn cán cao su', desc: 'Bộ 2 quấn cán cao su đàn hồi tốt, độ bám siêu dính', type: 'GRIP_2' },
    { target: 30, gift: 'Voucher giảm 20% giá sân', desc: 'Ưu đãi trừ 20% chi phí vào ca đánh kế tiếp', type: 'DISCOUNT_20' },
    { target: 35, gift: 'Voucher giảm 25% giá sân', desc: 'Ưu đãi trừ 25% chi phí cho tay vợt tích cực', type: 'DISCOUNT_25' },
    { target: 40, gift: 'Voucher giảm 30% giá sân', desc: 'Mức trợ giá 30% cực sâu cho thành viên nòng cốt', type: 'DISCOUNT_30' },
    { target: 45, gift: '2 Chai nước Revive ướp lạnh', desc: 'Combo 2 chai bù nước điện giải sảng khoái mát lạnh', type: 'REVIVE_2' },
    { target: 50, gift: '3 Quấn cán cao su cao cấp', desc: 'Bộ 3 quấn cán cao su chuyên dụng thi đấu cầu lông', type: 'GRIP_3' },
    { target: 55, gift: '3 Chai nước tăng lực Revive', desc: 'Combo 3 chai Revive tiếp sức thi đấu bùng nổ cùng đồng đội', type: 'REVIVE_3' },
    { target: 60, gift: 'Voucher giảm 30% giá slot', desc: 'Trợ giá 30% slot vào sân cho hội viên kỳ cựu', type: 'DISCOUNT_30' },
    { target: 65, gift: 'Voucher giảm 35% giá slot', desc: 'Mức trợ giá 35% tri ân sâu sắc thành viên gắn bó', type: 'DISCOUNT_35' },
    { target: 70, gift: '3 Chai nước tăng lực Revive', desc: 'Bổ sung thể lực tối đa cho những trận cầu rực lửa', type: 'REVIVE_3' },
    { target: 80, gift: 'Voucher giảm 38% giá slot', desc: 'Ưu đãi giảm 38% chi phí ca đánh tại CLB', type: 'DISCOUNT_38' },
    { target: 90, gift: 'Voucher giảm 40% giá slot', desc: 'Trợ giá khủng 40% cho tay vợt tâm huyết của làng', type: 'DISCOUNT_40' },
    { target: 100, gift: '1 Đôi vớ Yonex chính hãng', desc: 'Vớ thể thao Yonex dày dặn, thấm hút mồ hôi, êm chân chuẩn thi đấu', type: 'YONEX_SOCKS' },
  ]

  const isVoucherType = (type: string) => type.startsWith('DISCOUNT')
  const nextMilestone = milestones.find((m) => m.target > attended) || milestones[milestones.length - 1]

  const unclaimedRewards = (rewards || []).filter((r) => !r.isClaimed)
  const unclaimedCount = unclaimedRewards.length

  const handleOpenUnboxing = (m: (typeof milestones)[0], isClaimed: boolean) => {
    setUnboxingMilestone({
      target: m.target,
      gift: m.gift,
      desc: m.desc,
      type: m.type,
      isClaimed,
    })
    setIsRevealed(isClaimed)
  }

  // Lịch
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate()

  const attendanceMap = new Map<string, AttendanceRecord[]>()
  ;(history || []).forEach((h) => {
    const key = vnDateKey(h.checkinAt)
    if (!key) return
    attendanceMap.set(key, [...(attendanceMap.get(key) || []), h])
  })

  const monthKeyPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  const todayKey = vnDateKey(new Date())
  const thisMonthAttendedCount = (history || []).filter((h) => vnDateKey(h.checkinAt).startsWith(monthKeyPrefix)).length

  return (
    <div className="saas-card rounded-3xl p-5 sm:p-8 space-y-6 border border-slate-300 shadow-xl shadow-slate-900/[0.04] bg-white">
      {/* Header gọn gàng */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            CLB CẦU LÔNG LÀNG ĐỊA NGỤC
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mt-0.5">
            Đổi thưởng
          </h1>
        </div>

        {/* Tab 50/50 */}
        <div
          role="tablist"
          aria-label="Loại hiển thị"
          className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold w-full sm:w-auto sm:min-w-[260px] shrink-0"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'REWARDS'}
            onClick={() => setActiveTab('REWARDS')}
            className={`min-h-9 py-2 px-3.5 rounded-lg transition cursor-pointer whitespace-nowrap text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'REWARDS'
                ? 'bg-white text-slate-950 shadow-xs border border-slate-200/80 font-black'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <Gift size={14} />
            <span>Quà tặng</span>
            {unclaimedCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
            )}
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'CALENDAR'}
            onClick={() => setActiveTab('CALENDAR')}
            className={`min-h-9 py-2 px-3.5 rounded-lg transition cursor-pointer whitespace-nowrap text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'CALENDAR'
                ? 'bg-white text-slate-950 shadow-xs border border-slate-200/80 font-black'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <CalendarIcon size={14} />
            <span>Lịch ra sân</span>
          </button>
        </div>
      </div>

      {/* Action Banner khi có quà chờ mở */}
      {user && unclaimedCount > 0 && (
        <div className="flex items-center justify-between p-3.5 sm:p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="text-xs font-black text-amber-950 truncate">
              Bạn có {unclaimedCount} hộp quà đã mở khóa!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('REWARDS')}
            className="min-h-8.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1 bg-amber-900 text-white hover:bg-amber-950 shadow-2xs"
          >
            <span>Mở ngay</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-800 text-amber-100 font-black">
              {unclaimedCount}
            </span>
          </button>
        </div>
      )}

      {/* Hero tóm tắt tiến trình (Cắt hết chữ thừa) */}
      {user ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <DuckMascot
              src={profile?.avatarUrl || user.avatarUrl || '/duck-mascot.png'}
              size={50}
              rounded="2xl"
              className="shadow-xs border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 block truncate">
                {user.fullName}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-950">
                  {attended}
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  ca ra sân
                </span>
              </div>
            </div>
          </div>

          <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200 sm:min-w-[220px]">
            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
              <span className="font-bold text-slate-900">Mốc {nextMilestone.target} buổi</span>
              <span className="text-[11px] text-slate-500 font-semibold">
                (còn {Math.max(0, nextMilestone.target - attended)} ca)
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden p-0.5 mt-1.5 border border-slate-300">
              <div
                className="bg-slate-950 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (attended / nextMilestone.target) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-600 font-medium">
            Đăng nhập để theo dõi số ca và nhận quà chuyên cần.
          </span>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="min-h-9 px-4 py-1.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0 cursor-pointer"
          >
            Đăng nhập
          </button>
        </div>
      )}

      {/* TAB 1: BỘ SƯU TẬP HỘP QUÀ TRỰC QUAN */}
      {activeTab === 'REWARDS' && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 text-xs">
            <span className="font-bold text-slate-900">Bộ sưu tập hộp quà</span>
            <span className="text-slate-500 font-medium">{milestones.length} mốc</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {milestones.map((m) => {
              const isReached = !!user && attended >= m.target
              const rewardRecord = rewards?.find((r) => r.milestoneSessions === m.target)
              const isClaimed = !!rewardRecord?.isClaimed

              return (
                <div
                  key={m.target}
                  onClick={() => {
                    if (isReached) {
                      handleOpenUnboxing(m, isClaimed)
                    }
                  }}
                  className={`p-3.5 sm:p-4 rounded-3xl border transition duration-200 flex flex-col items-center justify-between text-center relative group ${
                    isReached && !isClaimed
                      ? 'bg-amber-50/40 border-amber-300 ring-2 ring-amber-300/60 hover:shadow-xl hover:scale-[1.02] cursor-pointer shadow-md'
                      : isReached && isClaimed
                      ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md cursor-pointer'
                      : 'bg-slate-50/80 border-slate-200/90 cursor-default opacity-90'
                  }`}
                >
                  {/* Top Bar: Mốc & Trạng thái */}
                  <div className="w-full flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800">
                      Mốc {m.target}
                    </span>
                    {isClaimed ? (
                      <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                        <Check size={11} strokeWidth={3} /> Đã nhận
                      </span>
                    ) : isReached ? (
                      <span className="text-[10px] font-black text-rose-600 animate-pulse">
                        Mở ngay!
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-0.5">
                        <Lock size={10} /> Còn {m.target - attended} ca
                      </span>
                    )}
                  </div>

                  {/* Đồ họa hộp quà: Có bao bọc/che lại trực quan, không để trống */}
                  <div className="my-2 flex items-center justify-center">
                    <GiftGraphic
                      type={m.type}
                      isReached={isReached}
                      isClaimed={isClaimed}
                      size="md"
                    />
                  </div>

                  {/* Tên quà: Đạt mốc hé lộ, chưa đạt giữ bí mật */}
                  <div className="w-full mt-1">
                    <h3 className="font-black text-xs sm:text-sm text-slate-950 truncate">
                      {isClaimed ? m.gift : isReached ? `Hộp quà mốc ${m.target}` : 'Quà bí mật'}
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium block truncate mt-0.5">
                      {isClaimed ? m.desc : isReached ? 'Chạm để mở nổ quà!' : `Đủ ${m.target} ca để mở`}
                    </span>
                  </div>

                  {/* Action CTA */}
                  <div className="w-full mt-3 pt-2 border-t border-slate-100">
                    {isClaimed ? (
                      <span className="text-[11px] font-bold text-slate-400">Đã nhận</span>
                    ) : isReached ? (
                      <button
                        type="button"
                        className="w-full py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 text-white font-black text-[11px] shadow-xs hover:brightness-105 transition active:scale-95 cursor-pointer"
                      >
                        Mở quà ✨
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-400">Chưa mở khóa</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 2: LỊCH RA SÂN */}
      {activeTab === 'CALENDAR' && (
        <div className="space-y-4 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-950">
                Lịch ra sân {monthNamesVi[month]} {year}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
                {thisMonthAttendedCount} buổi
              </span>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-white transition cursor-pointer"
                  title="Tháng trước"
                  aria-label="Tháng trước"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentDate(vnMonthStart())}
                  className="px-2 py-1 text-xs font-bold text-slate-800 hover:text-slate-950 transition cursor-pointer"
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-white transition cursor-pointer"
                  title="Tháng sau"
                  aria-label="Tháng sau"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Grid Lịch */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-slate-500">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d, i) => (
                <div
                  key={d}
                  className={`py-1.5 rounded-lg text-[11px] font-black ${
                    i === 0 || i === 6 ? 'text-rose-600 bg-rose-50/50' : 'text-slate-600 bg-slate-50'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {Array.from({ length: firstDayIndex }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-11 sm:h-14 rounded-xl bg-slate-50/40 border border-slate-100" />
              ))}

              {Array.from({ length: totalDaysInMonth }).map((_, idx) => {
                const dayNum = idx + 1
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                const dayRecords = attendanceMap.get(dateKey) || []
                const isAttended = dayRecords.length > 0
                const isToday = dateKey === todayKey
                const dayLabel = `${String(dayNum).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`
                const CellTag = isAttended ? 'button' : 'div'

                return (
                  <CellTag
                    key={dateKey}
                    {...(isAttended
                      ? {
                          type: 'button' as const,
                          onClick: () => setSelectedDay({ label: dayLabel, records: dayRecords }),
                          'aria-label': `Ngày ${dayLabel}: đã ra sân ${dayRecords.length} ca`,
                        }
                      : {})}
                    className={`h-11 sm:h-14 rounded-xl p-1 sm:p-1.5 flex flex-col justify-between transition border text-left ${
                      isAttended
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs cursor-pointer hover:bg-emerald-700'
                        : isToday
                        ? 'bg-white border-2 border-slate-950 font-black'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-black ${isAttended ? 'text-white' : 'text-slate-900'}`}>
                        {dayNum}
                      </span>
                      {isAttended && <Check size={11} strokeWidth={3.5} className="text-white" />}
                    </div>

                    {isAttended && (
                      <span className="text-[9px] font-bold text-emerald-100 truncate hidden sm:block">
                        {dayRecords[0]?.venueName || 'Đã ra sân'}
                      </span>
                    )}
                  </CellTag>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* POPUP NỔ RƯƠNG 3D VÀ HÉ LỘ PHẦN THƯỞNG */}
      <BottomSheet
        open={!!unboxingMilestone}
        onClose={() => setUnboxingMilestone(null)}
        title={unboxingMilestone ? `Mốc ${unboxingMilestone.target} buổi` : ''}
        bodyClassName="relative space-y-4 text-center overflow-hidden"
      >
        {unboxingMilestone && (
          <>
            {!isRevealed ? (
              /* Trạng thái 1: Hộp quà 3D kích thích mở */
              <div className="py-6 flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-950 font-black text-xs uppercase tracking-wider">
                  <Sparkles size={14} className="text-amber-600" />
                  <span>Hộp Quà Mốc {unboxingMilestone.target} Buổi</span>
                </div>

                {/* Hộp quà 3D nẩy bay lượn */}
                <div
                  onClick={() => setIsRevealed(true)}
                  className="group cursor-pointer flex flex-col items-center justify-center select-none"
                >
                  <div className="relative transition-all duration-300 transform group-hover:scale-110 group-active:scale-95 animate-bounce">
                    <div className="w-36 h-36 rounded-3xl bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-400 p-1.5 shadow-2xl shadow-amber-500/40">
                      <div className="w-full h-full rounded-[20px] bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden border border-amber-300/40">
                        <div className="text-6xl filter drop-shadow-lg">🎁</div>
                        <span className="text-[10px] font-black uppercase text-amber-300 mt-1.5 tracking-wider">
                          Chạm để mở
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRevealed(true)}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-rose-600 to-amber-500 hover:brightness-110 text-white font-black text-sm rounded-2xl shadow-lg shadow-rose-600/30 transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} />
                  <span>Mở hộp quà ngay</span>
                </button>
              </div>
            ) : (
              /* Trạng thái 2: Nổ bung quà 3D hé lộ phần thưởng */
              <div className="py-3 flex flex-col items-center text-center space-y-4 animate-in zoom-in-75 duration-300">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 font-black text-xs uppercase tracking-wider">
                  <Sparkles size={13} className="text-amber-600" />
                  <span>{unboxingMilestone.isClaimed ? 'ĐÃ NHẬN THƯỞNG' : 'CHÚC MỪNG MỞ QUÀ THÀNH CÔNG!'}</span>
                </div>

                {/* Đồ họa quà kích thước lớn 3D */}
                <div className="relative py-2">
                  <GiftGraphic
                    type={unboxingMilestone.type}
                    isReached={true}
                    isClaimed={true}
                    forceReveal={true}
                    size="xl"
                    className="shadow-2xl ring-4 ring-amber-400/30"
                  />
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                    {unboxingMilestone.gift}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto leading-relaxed">
                    {unboxingMilestone.desc}
                  </p>
                </div>

                {/* Hướng dẫn nhận gọn gàng */}
                <div className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium">
                  {isVoucherType(unboxingMilestone.type) ? (
                    <p>⚡ Voucher giảm giá tự động trừ khi bạn đăng ký ca tiếp theo.</p>
                  ) : (
                    <p>🏸 Gặp Host tại sân để nhận quà vật lý tận tay.</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setUnboxingMilestone(null)}
                  className="w-full min-h-11 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Tuyệt vời, đóng
                </button>
              </div>
            )}
          </>
        )}
      </BottomSheet>

      {/* Modal chi tiết ngày trên lịch */}
      <BottomSheet
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? `Ngày ${selectedDay.label}` : ''}
        bodyClassName="space-y-2.5"
      >
        {selectedDay?.records.map((r, i) => (
          <div
            key={`${r.sessionId}-${i}`}
            className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 flex items-start justify-between gap-3 text-left"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-black text-sm text-slate-950 leading-snug">{r.sessionTitle || 'Ca đánh CLB'}</p>
              <p className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                <MapPin size={13} className="shrink-0 text-slate-500" />
                <span className="truncate">{r.venueName || 'Tại sân đấu'}</span>
              </p>
              <p className="text-[11px] text-emerald-800 font-bold flex items-center gap-1.5">
                <Check size={13} strokeWidth={3} className="shrink-0" />
                <span>
                  Điểm danh lúc {formatVnTime(r.checkinAt)}
                </span>
              </p>
            </div>
            {r.sessionId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDay(null)
                  navigate(`/sessions/${r.sessionId}`)
                }}
                className="shrink-0 min-h-11 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-50 transition"
              >
                Xem ca
              </button>
            )}
          </div>
        ))}
      </BottomSheet>
    </div>
  )
}
