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
  AlertTriangle,
  ChevronDown,
} from 'lucide-react'
import { api } from '../lib/api'
import { MonthlyReport, ReconciliationEntry } from '../types'
import { DuckMascot } from '../components/DuckMascot'
import { formatVnDate, formatVnTime, getVnParts } from '../lib/dateUtils'
import { getEffectiveSessionStatus } from '../lib/sessionStatus'

/**
 * Thẻ chỉ-đọc cho Host: các lượt đã thu tiền + có cọc, thu trước bản sửa lỗi trừ cọc.
 * Khi đó tiền cọc bị trừ dù có thể chưa nhận → có thể đã thu thiếu đúng bằng tiền cọc. Không tự sửa dữ liệu.
 */
export const ReconciliationCard: React.FC<{ formatVnd: (n?: number) => string }> = ({ formatVnd }) => {
  const [open, setOpen] = useState(false)
  const { data: rows } = useQuery<ReconciliationEntry[]>({
    queryKey: ['deposit-reconciliation'],
    queryFn: async () => {
      const res = await api.get('/reports/reconciliation')
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  if (!rows || rows.length === 0) return null

  const totalDeposit = rows.reduce((sum, r) => sum + Number(r.depositAmount || 0), 0)

  return (
    <section
      aria-labelledby="reconciliation-title"
      className="bg-white rounded-3xl border border-amber-200 shadow-xs overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="reconciliation-body"
        className="w-full min-h-11 flex items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-amber-50/60 transition"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
            <AlertTriangle size={16} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="reconciliation-title" className="text-sm font-black text-slate-950">
              Đối soát cọc trước đây
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
              {rows.length} lượt • tổng cọc {formatVnd(totalDeposit)}
            </p>
          </div>
        </div>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div id="reconciliation-body" className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-3">
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed">
            Các lượt dưới đây đã được thu tiền <b>trước bản sửa lỗi tính cọc</b>. Khi đó tiền cọc luôn bị trừ vào số
            tiền thu (kể cả khi chưa thực nhận cọc), nên có thể đã <b>thu thiếu đúng bằng tiền cọc</b>. Hệ thống không tự
            sửa dữ liệu cũ — bạn có thể đối chiếu sao kê/ghi chép và xử lý tay nếu cần.
          </p>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.participantId}
                className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-black text-slate-900 block truncate">{r.name}</span>
                    <span className="text-xs text-slate-500 font-medium">{r.phone}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-slate-500 block">Cọc</span>
                    <span className="text-sm font-black text-amber-700">{formatVnd(Number(r.depositAmount))}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 font-medium truncate">
                  {r.sessionTitle}
                  {r.sessionStartTime && (
                    <> • {formatVnDate(r.sessionStartTime)}</>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
                  <span>
                    Giá ca: <b className="text-slate-800">{formatVnd(Number(r.finalFee))}</b>
                  </span>
                  <span>
                    Trạng thái cọc: <b className="text-slate-800">{DEPOSIT_LABEL[r.depositStatus] || r.depositStatus}</b>
                  </span>
                  <span>
                    Hình thức: <b className="text-slate-800">{r.paymentMethod === 'CASH' ? 'Tiền mặt' : r.paymentMethod === 'VIETQR' ? 'VietQR' : '—'}</b>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

const DEPOSIT_LABEL: Record<ReconciliationEntry['depositStatus'], string> = {
  NONE: 'Không cọc',
  PENDING: 'Chưa xác nhận',
  PAID: 'Đã xác nhận',
  FORFEITED: 'Giữ cọc',
  REFUNDED: 'Đã hoàn',
}

export const HostOverviewView: React.FC = () => {
  const navigate = useNavigate()
  // Tháng/năm hiện tại theo giờ Việt Nam
  const now = getVnParts(new Date())
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    // If year is 2026/2025
    return now.year
  })
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    return now.month
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

  const getEffectiveStatus = (s: MonthlyReport['sessionSummaries'][number]) =>
    getEffectiveSessionStatus({ status: s.status || 'UPCOMING', startTime: s.startTime ?? '', endTime: s.endTime ?? '' })

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

      {/* Đối soát cọc trước bản sửa lỗi (Q5) — chỉ hiện khi có dữ liệu */}
      <ReconciliationCard formatVnd={formatVnd} />

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
                {report.sessionSummaries.map((s) => {
                  const effStatus = getEffectiveStatus(s)
                  return (
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
                              effStatus === 'COMPLETED'
                                ? 'bg-slate-100 text-slate-700'
                                : effStatus === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {effStatus === 'COMPLETED' ? 'Đã xong' : effStatus === 'ACTIVE' ? 'Đang diễn ra' : 'Sắp tới'}
                          </span>
                        </div>
                      <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-slate-500 font-medium flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {s.startTime ? formatVnDate(s.startTime) : '--'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          {s.startTime ? formatVnTime(s.startTime) : '--'}
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
                )
              })}
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
