import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { LoyaltyReward, AttendanceRecord } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
import {
  Gift,
  CheckCircle2,
  Calendar as CalendarIcon,
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
  const [unlockedGiftModal, setUnlockedGiftModal] = useState<{
    target: number
    gift: string
  } | null>(null)

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

  const claimMutation = useMutation({
    mutationFn: async (rewardId: number) => {
      const res = await api.post(`/loyalty/${rewardId}/claim`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-rewards'] })
      alert('Nhận phần thưởng thành công! Vui lòng liên hệ Host tại sân để nhận quà.')
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Không thể nhận quà!')
    },
  })

  const attended = profile?.sessionsAttended ?? user?.sessionsAttended ?? 0
  const winCount = profile?.winCount ?? user?.winCount ?? 0

  // Defined Milestones with Surprise Gifts
  const milestones = [
    {
      target: 5,
      gift: '1 Chai nước tăng lực Revive',
      desc: 'Bù khoáng & năng lượng tức thì sau trận đấu',
      icon: '🍾',
      tag: 'Khởi đầu',
    },
    {
      target: 10,
      gift: 'Voucher giảm 15% tiền vé',
      desc: 'Áp dụng trừ trực tiếp vào hóa đơn ca tiếp theo',
      icon: '🏷️',
      tag: 'Bền bỉ',
    },
    {
      target: 20,
      gift: 'Combo 3 chai nước Revive',
      desc: 'Thoải mái quẩy hết mình cùng đồng đội',
      icon: '🍾🍾🍾',
      tag: 'Chuyên cần',
    },
    {
      target: 30,
      gift: '1 Quả cầu lông thi đấu xịn',
      desc: 'Cầu lông tiêu chuẩn thi đấu chính hãng',
      icon: '🏸',
      tag: 'Chiến binh',
    },
    {
      target: 40,
      gift: 'Gói Host VIP Premium',
      desc: 'Đặc quyền ưu tiên chọn sân & chỗ đánh cố định',
      icon: '👑',
      tag: 'VIP Member',
    },
    {
      target: 50,
      gift: 'Voucher giảm 35% tiền vé',
      desc: 'Trợ giá khủng cho tay vợt cống hiến',
      icon: '⚡',
      tag: 'Huyền thoại',
    },
    {
      target: 100,
      gift: 'FREE 100% Tiền Sân Ca Đấu',
      desc: 'Miễn phí hoàn toàn 1 ca đánh bất kỳ của CLB',
      icon: '🏆',
      tag: 'Đại sứ CLB',
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
              Đạt đủ số buổi để mở khóa hộp quà bí ẩn và nhận quà trực tiếp từ Host!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {milestones.map((m) => {
            const isReached = attended >= m.target
            const rewardRecord = rewards?.find((r) => r.milestoneSessions === m.target)
            const isClaimed = rewardRecord?.isClaimed

            return (
              <div
                key={m.target}
                className={`rounded-3xl p-6 border transition flex flex-col justify-between shadow-md relative overflow-hidden group ${
                  isReached
                    ? 'bg-white border-slate-300 hover:border-slate-400 shadow-slate-900/[0.06] hover:-translate-y-1 duration-200'
                    : 'bg-slate-50/70 border-slate-200/90 opacity-80'
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
                      Sẵn sàng mở!
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-black text-slate-400">
                      <Lock size={12} />
                      Khóa
                    </span>
                  )}
                </div>

                {/* Gift Visual Frame */}
                <div className="py-4 text-center flex flex-col items-center justify-center space-y-3">
                  <div
                    className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-inner border transition duration-300 ${
                      isReached
                        ? 'bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200 group-hover:scale-110 shadow-amber-200/50'
                        : 'bg-slate-100 border-slate-200 text-slate-300'
                    }`}
                  >
                    {isReached ? m.icon : '🎁'}
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-black text-slate-950 text-base leading-snug">
                      {isReached ? m.gift : `Hộp Quà Bí Ẩn #${m.target}`}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium line-clamp-2">
                      {isReached ? m.desc : 'Đạt mốc này để hé lộ phần quà bí mật từ CLB!'}
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
                  ) : isReached && rewardRecord ? (
                    <button
                      disabled={claimMutation.isPending}
                      onClick={() => claimMutation.mutate(rewardRecord.id)}
                      className="w-full py-3 bg-slate-950 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-lg shadow-slate-950/20 transition active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Sparkles size={14} className="text-amber-400" />
                      <span>Nhận quà ngay</span>
                    </button>
                  ) : isReached ? (
                    <button
                      onClick={() => setUnlockedGiftModal({ target: m.target, gift: m.gift })}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95"
                    >
                      Xem chi tiết quà
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

      {/* Detail Pop-up Modal */}
      {unlockedGiftModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-5 text-center animate-in zoom-in-90 duration-200">
            <div className="w-18 h-18 bg-amber-100 text-4xl rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              🎉
            </div>
            <div className="space-y-2">
              <span className="text-xs font-black text-rose-600 uppercase tracking-wider bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                Chúc mừng bạn đã đạt mốc!
              </span>
              <h3 className="text-xl font-black text-slate-950 mt-2">{unlockedGiftModal.gift}</h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Bạn đã tích lũy đủ <b>{unlockedGiftModal.target} buổi tham gia</b>. Vui lòng gặp Host tại sân trong ca đánh tới để nhận quà trực tiếp!
              </p>
            </div>
            <button
              onClick={() => setUnlockedGiftModal(null)}
              className="w-full py-3.5 bg-slate-950 text-white font-black text-xs rounded-xl hover:bg-slate-800 transition shadow-lg active:scale-95"
            >
              Đã hiểu & Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
