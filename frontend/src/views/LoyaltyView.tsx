import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { LoyaltyReward, AttendanceRecord } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
import { GiftGraphic } from '../components/GiftGraphic'
import {
  Gift,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  Lock,
  Trophy,
  Check,
  Zap,
  Activity,
  Award,
  PackageOpen,
  X,
} from 'lucide-react'

export const LoyaltyView: React.FC = () => {
  const { user, setAuth, token } = useAuthStore()
  const queryClient = useQueryClient()

  // Always fetch latest User profile (sessionsAttended, winCount, lossCount)
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
    refetchOnMount: 'always',
  })

  // Calendar date view state
  const [currentDate, setCurrentDate] = useState(new Date())

  // Unboxing Modal State
  const [unboxingMilestone, setUnboxingMilestone] = useState<{
    target: number
    gift: string
    desc: string
    type: string
    isClaimed: boolean
  } | null>(null)

  const [isRevealed, setIsRevealed] = useState(false)
  const [claimSuccess, setClaimSuccess] = useState(false)

  // 1. Fetch user claimed / available rewards
  const { data: rewards } = useQuery<LoyaltyReward[]>({
    queryKey: ['loyalty-rewards'],
    queryFn: async () => {
      const res = await api.get('/loyalty/my-rewards')
      return res.data
    },
    enabled: !!user,
    refetchOnMount: 'always',
  })

  // 2. Fetch user attendance history for calendar mapping
  const { data: history } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-history'],
    queryFn: async () => {
      const res = await api.get('/loyalty/attendance-history')
      return res.data
    },
    enabled: !!user,
    refetchOnMount: 'always',
  })

  const claimMilestoneMutation = useMutation({
    mutationFn: async (milestone: number) => {
      const res = await api.post(`/loyalty/milestone/${milestone}/claim`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-rewards'] })
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      setClaimSuccess(true)
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Không thể nhận quà!')
    },
  })

  const attended = profile?.sessionsAttended ?? user?.sessionsAttended ?? 0

  // Defined Milestones with Real Badminton Gear & Beverage Rewards
  const milestones = [
    {
      target: 5,
      gift: '1 Chai nước tăng lực Revive',
      desc: 'Bù khoáng & năng lượng tức thì sau set đấu kịch tính',
      tag: 'Khởi đầu',
      type: 'REVIVE',
    },
    {
      target: 10,
      gift: 'Voucher giảm 15% tiền vé',
      desc: 'Trừ trực tiếp vào hóa đơn ca đánh tiếp theo của CLB',
      tag: 'Bền bỉ',
      type: 'DISCOUNT_15',
    },
    {
      target: 20,
      gift: '1 Quấn cán vợt cao cấp',
      desc: 'Quấn cán vợt cầu lông êm ái, bám tay chống trơn trượt',
      tag: 'Chuyên cần',
      type: 'GRIP_1',
    },
    {
      target: 25,
      gift: '2 Quấn cán cao su',
      desc: 'Bộ 2 quấn cán cao su đàn hồi tốt, độ bám siêu dính',
      tag: 'Chiến binh',
      type: 'GRIP_2',
    },
    {
      target: 30,
      gift: 'Voucher giảm 20% giá sân',
      desc: 'Ưu đãi trừ 20% chi phí vào ca đánh kế tiếp',
      tag: 'Cống hiến',
      type: 'DISCOUNT_20',
    },
    {
      target: 35,
      gift: 'Voucher giảm 25% giá sân',
      desc: 'Ưu đãi trừ 25% chi phí cho tay vợt tích cực',
      tag: 'Tinh anh',
      type: 'DISCOUNT_25',
    },
    {
      target: 40,
      gift: 'Voucher giảm 30% giá sân',
      desc: 'Mức trợ giá 30% cực sâu cho thành viên nòng cốt',
      tag: 'VIP Member',
      type: 'DISCOUNT_30',
    },
    {
      target: 45,
      gift: '2 Chai nước Revive ướp lạnh',
      desc: 'Combo 2 chai bù nước điện giải sảng khoái mát lạnh',
      tag: 'Năng nổ',
      type: 'REVIVE_2',
    },
    {
      target: 50,
      gift: '3 Quấn cán cao su cao cấp',
      desc: 'Bộ 3 quấn cán cao su chuyên dụng thi đấu cầu lông',
      tag: 'Huyền thoại',
      type: 'GRIP_3',
    },
    {
      target: 55,
      gift: '3 Chai nước tăng lực Revive',
      desc: 'Combo 3 chai Revive tiếp sức thi đấu bùng nổ cùng đồng đội',
      tag: 'Đam mê',
      type: 'REVIVE_3',
    },
    {
      target: 60,
      gift: 'Voucher giảm 30% giá vé',
      desc: 'Trợ giá 30% vé vào sân cho hội viên kỳ cựu',
      tag: 'Bất khuất',
      type: 'DISCOUNT_30',
    },
    {
      target: 65,
      gift: 'Voucher giảm 35% giá vé',
      desc: 'Mức trợ giá 35% tri ân sâu sắc thành viên gắn bó',
      tag: 'Siêu sao',
      type: 'DISCOUNT_35',
    },
    {
      target: 70,
      gift: '3 Chai nước tăng lực Revive',
      desc: 'Bổ sung thể lực tối đa cho những trận cầu rực lửa',
      tag: 'Chiến tướng',
      type: 'REVIVE_3',
    },
    {
      target: 80,
      gift: 'Voucher giảm 38% giá vé',
      desc: 'Ưu đãi giảm 38% chi phí ca đánh tại CLB',
      tag: 'Kỳ tài',
      type: 'DISCOUNT_38',
    },
    {
      target: 90,
      gift: 'Voucher giảm 40% giá vé',
      desc: 'Trợ giá khủng 40% cho tay vợt tâm huyết của làng',
      tag: 'Bậc thầy',
      type: 'DISCOUNT_40',
    },
    {
      target: 100,
      gift: '1 Đôi vớ Yonex chính hãng',
      desc: 'Vớ thể thao Yonex dày dặn, thấm hút mồ hôi, êm chân chuẩn thi đấu',
      tag: 'Đại sứ CLB',
      type: 'YONEX_SOCKS',
    },
  ]

  // Next milestone calculation
  const nextMilestone = milestones.find((m) => m.target > attended) || milestones[milestones.length - 1]

  // Calendar Calculations
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() // 0-11
  const firstDayIndex = new Date(year, month, 1).getDay() // 0 (Sun) to 6 (Sat)
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate()

  // Convert checkinAt dates to Map for fast lookup + session info
  const attendanceMap = new Map<string, AttendanceRecord>()
  ;(history || []).forEach((h) => {
    const d = new Date(h.checkinAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`
    attendanceMap.set(key, h)
  })

  const thisMonthAttendedCount = (history || []).filter((h) => {
    const d = new Date(h.checkinAt)
    return d.getFullYear() === year && d.getMonth() === month
  }).length

  const attendanceRate = Math.round((thisMonthAttendedCount / (totalDaysInMonth || 30)) * 100)

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const setMonthToday = () => {
    setCurrentDate(new Date())
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

  const handleOpenUnboxing = (m: (typeof milestones)[0], isClaimed: boolean) => {
    setUnboxingMilestone({
      target: m.target,
      gift: m.gift,
      desc: m.desc,
      type: m.type,
      isClaimed,
    })
    setIsRevealed(isClaimed) // If already claimed, reveal immediately
    setClaimSuccess(isClaimed)
  }

  return (
    <div className="space-y-10">
      {/* 1. Header Hero Card: Chuyên Cần & Tri Ân */}
      <div className="saas-card rounded-3xl p-8 sm:p-10 space-y-6 relative overflow-hidden border border-slate-300 shadow-2xl shadow-slate-900/[0.05]">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-rose-500/[0.06] via-amber-500/[0.04] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950 text-white text-xs font-black shadow-md">
            <Gift size={15} className="text-rose-500" />
            <span>Chương trình Tri Ân & Điểm Danh Chuyên Cần CLB</span>
          </div>

          <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-2xl border border-slate-200 text-slate-800 text-xs font-black shadow-sm">
            <Flame size={15} className="text-rose-600 animate-pulse" />
            <span>
              {monthNamesVi[month]}: <b className="text-slate-950 font-black">{thisMonthAttendedCount} ca ra sân</b>
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <DuckMascot
              src={profile?.avatarUrl || user?.avatarUrl || '/duck-mascot.png'}
              size={78}
              rounded="2xl"
              className="shadow-md border border-slate-200"
            />
            <div>
              <span className="text-xs text-slate-500 font-bold">
                Thành viên: <b className="text-slate-950 font-black text-sm">{user?.fullName || 'Chưa đăng nhập'}</b>
              </span>
              <div className="flex items-baseline gap-2.5 mt-1">
                <span className="text-5xl sm:text-6xl font-black text-slate-950 tracking-tight">{attended}</span>
                <span className="text-sm sm:text-base text-slate-600 font-extrabold">Buổi tích lũy trọn đời</span>
              </div>
            </div>
          </div>

          <div className="p-5 bg-white rounded-3xl border border-slate-300 text-xs text-right shadow-lg shadow-slate-900/[0.04] space-y-1.5 min-w-[220px]">
            <span className="text-slate-500 block font-bold text-[11px] uppercase tracking-wider">Hộp Quà Bí Ẩn Kế Tiếp:</span>
            <div className="flex items-center justify-end gap-2">
              <span className="text-2xl animate-bounce">🎁</span>
              <b className="text-slate-950 text-lg font-black tracking-tight">
                Mốc {nextMilestone.target} buổi
              </b>
            </div>
            <span className="text-xs text-rose-600 font-black block bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200/80">
              ⚡ Cần thêm {Math.max(0, nextMilestone.target - attended)} buổi nữa
            </span>
          </div>
        </div>

        {/* Milestone Progress Bar */}
        <div className="space-y-2.5 pt-2 relative z-10">
          <div className="w-full bg-slate-200/90 h-4 rounded-full overflow-hidden p-0.5 border border-slate-300">
            <div
              className="bg-gradient-to-r from-slate-950 via-rose-600 to-amber-500 h-full rounded-full transition-all duration-700 shadow-md"
              style={{ width: `${Math.min(100, (attended / 100) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-600 font-black px-1 flex-wrap gap-1">
            <span>0</span>
            <span>5 buổi</span>
            <span>10 buổi</span>
            <span>20 buổi</span>
            <span>30 buổi</span>
            <span>40 buổi</span>
            <span>50 buổi</span>
            <span>100 buổi (FREE Sân)</span>
          </div>
        </div>
      </div>

      {/* 2. Ultra Luxurious & Bright Editorial Sports Calendar */}
      <div className="saas-card rounded-3xl p-6 sm:p-10 space-y-8 border border-slate-300/90 shadow-2xl shadow-slate-900/[0.05] relative overflow-hidden bg-white">
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-emerald-500/[0.05] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-rose-500/[0.05] rounded-full blur-3xl pointer-events-none" />

        {/* Calendar Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-200/90 pb-7 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
              <Sparkles size={13} className="text-emerald-600" />
              <span>Smart Check-in Tracker</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight flex items-center gap-3">
              <span>Lịch Điểm Danh & Nhật Ký Ra Sân</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-semibold">
              Tự động đánh dấu khi check-in QR GPS tại sân. Xây dựng thói quen thể thao kỷ luật!
            </p>
          </div>

          {/* Month Navigator & KPI Widgets */}
          <div className="flex flex-wrap items-center gap-3">
            {/* KPI Mini Badges */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 text-xs">
              <div className="px-3.5 py-1.5 bg-white rounded-xl shadow-xs border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-bold block">Tổng ca tháng:</span>
                <b className="text-slate-950 font-black text-sm">{thisMonthAttendedCount} buổi</b>
              </div>
              <div className="px-3.5 py-1.5 bg-white rounded-xl shadow-xs border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-bold block">Tỷ lệ chuyên cần:</span>
                <b className="text-emerald-700 font-black text-sm">{attendanceRate}%</b>
              </div>
            </div>

            {/* Navigator Control Capsule */}
            <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl shadow-lg shadow-slate-950/15 border border-slate-900">
              <button
                onClick={prevMonth}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition active:scale-90"
                title="Tháng trước"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                onClick={setMonthToday}
                className="px-4 py-1.5 text-xs font-black text-white hover:text-amber-300 transition"
                title="Về tháng hiện tại"
              >
                {monthNamesVi[month]} {year}
              </button>

              <button
                onClick={nextMonth}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition active:scale-90"
                title="Tháng sau"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Calendar Board */}
        <div className="space-y-3 relative z-10">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-2 sm:gap-3 text-center">
            {['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'].map((dayName, idx) => (
              <div
                key={dayName}
                className={`py-2.5 rounded-xl text-xs font-black tracking-wider uppercase ${
                  idx === 0 || idx === 6
                    ? 'bg-rose-50/70 text-rose-700 border border-rose-200/60'
                    : 'bg-slate-100/80 text-slate-600 border border-slate-200/60'
                }`}
              >
                <span className="hidden sm:inline">{dayName}</span>
                <span className="sm:hidden">{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][idx]}</span>
              </div>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 gap-2 sm:gap-3.5">
            {/* Empty Offset Days */}
            {Array.from({ length: firstDayIndex }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="min-h-[85px] sm:min-h-[105px] rounded-2xl bg-slate-50/40 border border-dashed border-slate-200/80 flex items-center justify-center"
              >
                <span className="text-slate-200 text-xs font-bold">•</span>
              </div>
            ))}

            {/* Days of current month */}
            {Array.from({ length: totalDaysInMonth }).map((_, idx) => {
              const dayNum = idx + 1
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
              const attendInfo = attendanceMap.get(dateKey)
              const isAttended = !!attendInfo
              const isToday =
                new Date().getDate() === dayNum &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year

              return (
                <div
                  key={dateKey}
                  className={`min-h-[85px] sm:min-h-[105px] rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all duration-200 border relative group ${
                    isAttended
                      ? 'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/20 hover:scale-[1.03] hover:shadow-xl hover:z-20'
                      : isToday
                      ? 'bg-white border-2 border-slate-950 shadow-md ring-4 ring-slate-950/5 hover:border-slate-800'
                      : 'bg-white border border-slate-200 hover:border-slate-400 hover:shadow-md'
                  }`}
                >
                  {/* Top Bar of Cell */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm sm:text-base font-black tracking-tight ${
                        isAttended ? 'text-white' : isToday ? 'text-slate-950' : 'text-slate-700 group-hover:text-slate-950'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {isToday && (
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider shadow-xs ${
                          isAttended ? 'bg-white text-emerald-900' : 'bg-slate-950 text-white'
                        }`}
                      >
                        Hôm nay
                      </span>
                    )}

                    {isAttended && !isToday && (
                      <span className="text-xs animate-pulse">✨</span>
                    )}
                  </div>

                  {/* Cell Center Content / Attendance Stamp */}
                  <div className="my-auto flex flex-col items-center justify-center">
                    {isAttended ? (
                      <div className="flex flex-col items-center gap-0.5 animate-in zoom-in-75 duration-300">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
                          <Check size={16} strokeWidth={3.5} />
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-black tracking-wide uppercase mt-0.5 drop-shadow-xs">
                          Đã ra sân 🏸
                        </span>
                      </div>
                    ) : (
                      <div className="h-6 flex items-center justify-center">
                        <span className="text-slate-200 group-hover:text-slate-300 text-xs font-bold transition">
                          •
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Meta */}
                  <div className="text-[9px] font-semibold truncate text-right">
                    {isAttended ? (
                      <span className="text-emerald-100 font-bold block truncate">
                        {attendInfo?.venueName || 'Tại sân đấu'}
                      </span>
                    ) : (
                      <span className="text-transparent group-hover:text-slate-400 transition select-none">
                        Trống
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend & Motivation Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200/90 text-xs relative z-10">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2 bg-emerald-50 px-3.5 py-1.5 rounded-xl border border-emerald-200 text-emerald-950 font-bold">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-xs ring-2 ring-emerald-300" />
              <span>Đã quét QR & Check-in sân</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold">
              <span className="w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-300" />
              <span>Ngày chưa có ca</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-900 font-black">
              <span className="w-3.5 h-3.5 rounded-full bg-slate-950" />
              <span>Ngày hôm nay</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-500 font-semibold text-[11px]">
            <Activity size={14} className="text-emerald-600" />
            <span>Tự động kích hoạt chuỗi tích lũy nhận Hộp Quà Bí Ẩn</span>
          </div>
        </div>
      </div>

      {/* 3. Mystery Gift & Milestone Unlocking Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950 flex items-center gap-2.5 tracking-tight">
              <Sparkles size={24} className="text-amber-500" />
              <span>Danh Sách Hộp Quà Bí Ẩn & Phần Thưởng Tri Ân</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-1">
              Đạt đủ số buổi để mở khóa hộp quà bí ẩn và nhận quà thực tế từ Host CLB!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {milestones.map((m) => {
            const isReached = attended >= m.target
            const rewardRecord = rewards?.find((r) => r.milestoneSessions === m.target)
            const isClaimed = !!rewardRecord?.isClaimed

            return (
              <div
                key={m.target}
                onClick={() => isReached && handleOpenUnboxing(m, isClaimed)}
                className={`rounded-3xl p-6 border transition flex flex-col justify-between shadow-md relative overflow-hidden group ${
                  isReached
                    ? 'bg-white border-slate-300 hover:border-amber-400 hover:shadow-xl shadow-slate-900/[0.06] hover:-translate-y-1 duration-200 cursor-pointer'
                    : 'bg-slate-50/70 border-slate-200/90 opacity-80 cursor-not-allowed'
                }`}
              >
                {/* Milestone Badge Tag */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                      isReached
                        ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                        : 'bg-slate-200 text-slate-600 border-slate-300'
                    }`}
                  >
                    Mốc {m.target} Buổi • {m.tag}
                  </span>

                  {isClaimed ? (
                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      <CheckCircle2 size={12} />
                      Đã nhận
                    </span>
                  ) : isReached ? (
                    <span className="text-[10px] font-black text-rose-600 animate-pulse bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                      Mở hộp ngay!
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-black text-slate-400">
                      <Lock size={12} />
                      Khóa
                    </span>
                  )}
                </div>

                {/* Gift Visual Frame with Realistic Graphics */}
                <div className="py-4 text-center flex flex-col items-center justify-center space-y-3">
                  <GiftGraphic
                    type={m.type}
                    isReached={isReached}
                    isClaimed={isClaimed}
                    size="lg"
                  />

                  <div className="space-y-1">
                    <h3 className="font-black text-slate-950 text-base leading-snug">
                      {isClaimed ? m.gift : `Hộp Quà Bí Ẩn #${m.target}`}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium line-clamp-2">
                      {isClaimed
                        ? m.desc
                        : isReached
                        ? 'Đã đủ điều kiện! Nhấn để mở hộp quà bí ẩn ngay.'
                        : 'Đạt mốc này để hé lộ phần quà bí mật từ CLB!'}
                    </p>
                  </div>
                </div>

                {/* Bottom CTA Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center">
                  {isClaimed ? (
                    <span className="text-xs font-black text-slate-500 py-1 flex items-center gap-1">
                      <Check size={14} className="text-emerald-600" />
                      <span>Đã nhận quà thành công</span>
                    </span>
                  ) : isReached ? (
                    <button
                      type="button"
                      className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-black text-xs rounded-xl shadow-md shadow-rose-500/20 transition active:scale-95 flex items-center justify-center gap-2"
                    >
                      <PackageOpen size={15} />
                      <span>Mở hộp & Nhận quà</span>
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-slate-400">
                      Cần thêm {m.target - attended} buổi để mở
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 4. Interactive 3D Unboxing & Claim Modal */}
      {unboxingMilestone && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200 relative overflow-hidden">
            {/* Ambient Background Burst */}
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-amber-400/20 via-rose-400/10 to-transparent pointer-events-none" />

            <button
              onClick={() => setUnboxingMilestone(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-950 hover:bg-slate-100 transition z-10"
            >
              <X size={20} />
            </button>

            {!isRevealed ? (
              /* State 1: Mystery Box Ready to be Tapped */
              <div className="space-y-6 py-4 relative z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-black uppercase tracking-wider">
                  <Sparkles size={14} />
                  <span>Hộp Quà Mốc {unboxingMilestone.target} Buổi</span>
                </div>

                <div
                  onClick={() => setIsRevealed(true)}
                  className="cursor-pointer group flex flex-col items-center justify-center py-4"
                >
                  <div className="relative transform group-hover:scale-110 transition duration-300 animate-bounce">
                    <div className="w-36 h-36 rounded-3xl bg-gradient-to-br from-amber-400 via-rose-500 to-amber-600 p-1 shadow-2xl shadow-rose-500/30 flex items-center justify-center">
                      <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center text-6xl">
                        🎁
                      </div>
                    </div>
                  </div>
                  <p className="text-xs font-black text-amber-600 mt-6 animate-pulse uppercase tracking-wider">
                    👉 Nhấn vào hộp quà để mở hé lộ!
                  </p>
                </div>

                <button
                  onClick={() => setIsRevealed(true)}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-rose-600 text-white font-black text-sm rounded-2xl hover:brightness-110 transition shadow-lg shadow-rose-600/30 active:scale-95"
                >
                  Mở hộp quà ngay ✨
                </button>
              </div>
            ) : (
              /* State 2: Revealed Item with Graphic & Claim CTA */
              <div className="space-y-5 relative z-10 animate-in zoom-in-75 duration-300">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black uppercase tracking-wider">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Chúc Mừng Đạt Mốc {unboxingMilestone.target} Buổi!</span>
                </div>

                <div className="flex flex-col items-center justify-center py-2">
                  <GiftGraphic
                    type={unboxingMilestone.type}
                    isReached={true}
                    isClaimed={true}
                    forceReveal={true}
                    size="xl"
                    className="shadow-2xl ring-4 ring-amber-400/30"
                  />
                  <h3 className="text-2xl font-black text-slate-950 mt-4 tracking-tight">
                    {unboxingMilestone.gift}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1.5 max-w-xs leading-relaxed">
                    {unboxingMilestone.desc}
                  </p>
                </div>

                {claimSuccess || unboxingMilestone.isClaimed ? (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950 space-y-2">
                    <div className="flex items-center justify-center gap-2 font-black text-sm text-emerald-800">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      <span>Đã nhận phần thưởng thành công!</span>
                    </div>
                    <p className="text-xs text-emerald-700 font-semibold leading-relaxed">
                      Thông tin nhận quà đã được ghi nhận. Vui lòng gặp Host tại sân để nhận hiện vật hoặc áp dụng giảm giá ca tiếp theo!
                    </p>
                    <button
                      onClick={() => setUnboxingMilestone(null)}
                      className="w-full mt-2 py-3 bg-slate-950 text-white font-black text-xs rounded-xl hover:bg-slate-800 transition"
                    >
                      Tuyệt vời! Đóng
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <button
                      disabled={claimMilestoneMutation.isPending}
                      onClick={() => claimMilestoneMutation.mutate(unboxingMilestone.target)}
                      className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition active:scale-95 flex items-center justify-center gap-2"
                    >
                      {claimMilestoneMutation.isPending ? (
                        <span>Đang xử lý nhận quà...</span>
                      ) : (
                        <>
                          <Sparkles size={18} className="text-amber-300" />
                          <span>Nhận món quà này ngay</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setUnboxingMilestone(null)}
                      className="w-full py-2.5 text-xs text-slate-500 font-bold hover:text-slate-800 transition"
                    >
                      Để sau
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
