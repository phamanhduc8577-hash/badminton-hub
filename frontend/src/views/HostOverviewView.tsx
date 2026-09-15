import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Activity,
  QrCode,
  Banknote,
  Award,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react'
import { api } from '../lib/api'
import { MonthlyReport } from '../types'
import { DuckMascot } from '../components/DuckMascot'

export const HostOverviewView: React.FC = () => {
  const navigate = useNavigate()
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    // If year is 2026/2025
    return now.getFullYear()
  })
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    return now.getMonth() + 1
  })

  const { data: report, isLoading } = useQuery<MonthlyReport>({
    queryKey: ['monthly-report', selectedYear, selectedMonth],
    queryFn: async () => {
      const res = await api.get('/reports/monthly', {
        params: { year: selectedYear, month: selectedMonth },
      })
      return res.data
    },
  })

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear((y) => y - 1)
    } else {
      setSelectedMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear((y) => y + 1)
    } else {
      setSelectedMonth((m) => m + 1)
    }
  }

  const formatVnd = (num?: number) => {
    if (num === undefined || num === null) return '0 ₫'
    return `${num.toLocaleString('vi-VN')} ₫`
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950 rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600/30 border border-rose-500/40 text-rose-300 text-[11px] sm:text-xs font-bold tracking-wide">
              <ShieldCheck size={13} />
              <span>Host Financial Console</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight">
              Báo Cáo Tổng Quan CLB
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-medium">
              Theo dõi dòng tiền, doanh thu ca đánh, chi phí sân cầu và tỷ lệ tăng trưởng thành viên theo tháng.
            </p>
          </div>

          {/* Month Navigator */}
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/15">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-white/20 rounded-xl transition text-white active:scale-95"
              title="Tháng trước"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-3 text-center flex-1 sm:flex-initial">
              <span className="text-[9px] sm:text-[10px] text-slate-300 block font-bold uppercase tracking-wider">
                Tháng thống kê
              </span>
              <span className="text-sm sm:text-base font-black text-white">
                {selectedMonth.toString().padStart(2, '0')}/{selectedYear}
              </span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-white/20 rounded-xl transition text-white active:scale-95"
              title="Tháng sau"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-900 border-t-transparent mb-3" />
          <p className="text-xs text-slate-500 font-bold">Đang tổng hợp dữ liệu tài chính tháng...</p>
        </div>
      ) : (
        <>
          {/* KPI 4 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Doanh thu */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Tổng doanh thu</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <DollarSign size={18} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-950">
                  {formatVnd(report?.totalRevenue)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">
                  Cọc đã thu: <span className="font-bold text-slate-700">{formatVnd(report?.totalDepositCollected)}</span>
                </div>
              </div>
            </div>

            {/* Chi phí */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Tổng chi phí</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-rose-600">
                  {formatVnd(report?.totalExpenses)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                  <span>Sân: {formatVnd(report?.costCourt)}</span>
                  <span>•</span>
                  <span>Cầu: {formatVnd(report?.costShuttlecock)}</span>
                </div>
              </div>
            </div>

            {/* Lợi nhuận ròng */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Lợi nhuận ròng (Net)</span>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Sparkles size={18} />
                </div>
              </div>
              <div>
                <div
                  className={`text-2xl font-black ${
                    (report?.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {formatVnd(report?.netProfit)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">
                  Tỷ suất lợi nhuận:{' '}
                  <span className="font-bold text-slate-800">
                    {report?.totalRevenue
                      ? `${Math.round(((report.netProfit || 0) / report.totalRevenue) * 100)}%`
                      : '0%'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quy mô ca đánh & Tỷ lệ điểm danh */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Tổng ca & Lượt chơi</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Users size={18} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-950">
                  {report?.totalSessions || 0} ca{' '}
                  <span className="text-sm text-slate-500 font-bold">({report?.totalPlayerTurnout || 0} lượt)</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">
                  Điểm danh: <span className="font-bold text-emerald-600">{report?.attendanceRate || 0}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Phân loại thành viên */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-rose-600" />
                <h3 className="text-sm font-black text-slate-950">Cơ cấu thành viên tham gia</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>Thành viên Cố định</span>
                    <span className="text-rose-600">{report?.fixedMemberTurnout || 0} lượt</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-600 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          report?.totalPlayerTurnout
                            ? Math.min(100, Math.round(((report.fixedMemberTurnout || 0) / report.totalPlayerTurnout) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>Khách Vãng lai</span>
                    <span className="text-slate-900">{report?.guestTurnout || 0} lượt</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-slate-900 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          report?.totalPlayerTurnout
                            ? Math.min(100, Math.round(((report.guestTurnout || 0) / report.totalPlayerTurnout) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Tỷ lệ Giới tính:</span>
                  <span className="font-bold text-slate-800">
                    {report?.maleTurnout || 0} Nam • {report?.femaleTurnout || 0} Nữ
                  </span>
                </div>
              </div>
            </div>

            {/* Phương thức thanh toán */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <QrCode size={16} className="text-emerald-600" />
                <h3 className="text-sm font-black text-slate-950">Hình thức thanh toán</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                      <QrCode size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 block">VietQR Tự Động</span>
                      <span className="text-[10px] text-slate-500 font-medium">Chuyển khoản SePay</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-emerald-700">
                    {report?.vietQrPayments || 0} lượt
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                      <Banknote size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 block">Tiền Mặt Trực Tiếp</span>
                      <span className="text-[10px] text-slate-500 font-medium">Host thu tại sân</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-900">
                    {report?.cashPayments || 0} lượt
                  </span>
                </div>

                {report?.unpaidCount ? (
                  <div className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded-xl text-center">
                    ⚠️ Còn {report.unpaidCount} lượt chưa thanh toán trong tháng
                  </div>
                ) : null}
              </div>
            </div>

            {/* Top chiến thần tháng */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-amber-500" />
                  <h3 className="text-sm font-black text-slate-950">Top Thành Viên Năng Nổ</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400">Tháng {selectedMonth}</span>
              </div>
              <div className="space-y-2">
                {report?.topPlayers && report.topPlayers.length > 0 ? (
                  report.topPlayers.slice(0, 4).map((p, idx) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 text-center text-xs font-black text-slate-400">
                          #{idx + 1}
                        </span>
                        <DuckMascot src={p.avatarUrl || '/duck-mascot.png'} size={28} rounded="full" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block truncate max-w-[110px]">
                            {p.fullName}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {p.membershipType === 'FIXED' ? 'Cố định' : 'Vãng lai'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-600 block">{p.winCount}W</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{p.lossCount}L</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400 font-medium">
                    Chưa có lượt trận nào trong tháng
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Session Summaries Table / Live List */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-950">
                  Lịch Sử & Báo Cáo Từng Ca Đánh ({selectedMonth}/{selectedYear})
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
                  Bấm vào ca đánh bất kỳ để mở Host Panel điều hành trực tiếp
                </p>
              </div>
              <button
                onClick={() => navigate('/host/create-session')}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-sm text-center"
              >
                + Tạo ca mới
              </button>
            </div>

            {report?.sessionSummaries && report.sessionSummaries.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                {report.sessionSummaries.map((s) => (
                  <div
                    key={s.sessionId}
                    onClick={() => navigate(`/host/session/${s.sessionId}`)}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-slate-50/80 transition cursor-pointer group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-rose-600 transition">
                          {s.title}
                        </span>
                        <span
                          className={`text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            s.status === 'COMPLETED'
                              ? 'bg-slate-100 text-slate-700'
                              : s.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {s.status === 'COMPLETED' ? 'Đã xong' : s.status === 'ACTIVE' ? 'Đang diễn ra' : 'Sắp tới'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-slate-500 font-medium flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {s.startTime ? new Date(s.startTime).toLocaleDateString('vi-VN') : '--'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          {s.startTime ? new Date(s.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                        </span>
                        <span>•</span>
                        <span>Quân số: <b className="text-slate-800">{s.checkedInPlayers}/{s.totalPlayers}</b></span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <div className="text-[11px] sm:text-xs text-slate-500">
                          Thu: <b className="text-slate-800">{formatVnd(s.totalRevenue)}</b> | Chi: <b className="text-rose-600">{formatVnd(s.totalExpenses)}</b>
                        </div>
                        <div className="text-xs sm:text-sm font-black mt-0.5">
                          Lãi ròng:{' '}
                          <span className={(s.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {formatVnd(s.netProfit)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-rose-600 text-white text-[11px] sm:text-xs font-bold group-hover:bg-rose-700 transition shadow-xs shrink-0">
                        <span>Host Panel</span>
                        <ArrowUpRight size={13} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-500 font-bold">Không có ca đánh nào trong tháng {selectedMonth}/{selectedYear}</p>
                <button
                  onClick={() => navigate('/host/create-session')}
                  className="mt-3 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                >
                  Tạo ca đánh đầu tiên của tháng
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
