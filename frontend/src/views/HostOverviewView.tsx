import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Calendar,
  Clock,
  PlayCircle,
  AlertTriangle,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  Receipt,
  Users,
  CreditCard,
  Banknote,
  Trophy,
  PieChart,
  Plus,
} from 'lucide-react'
import { api } from '../lib/api'
import { MonthlyReport, ReconciliationEntry } from '../types'
import { DuckMascot } from '../components/DuckMascot'
import { formatVnDate, formatVnTime, getVnParts } from '../lib/dateUtils'
import { getEffectiveSessionStatus } from '../lib/sessionStatus'

/**
 * Thẻ chỉ-đọc cho Host: các lượt đã thu tiền + có cọc, thu trước bản sửa lỗi trừ cọc.
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
      className="bg-amber-50/60 rounded-2xl border border-amber-200/80 overflow-hidden text-slate-800 transition-all"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="reconciliation-body"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-amber-100/40 transition"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg shrink-0">
            <AlertTriangle size={15} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="reconciliation-title" className="text-xs font-bold text-amber-950">
              Đối soát cọc trước đây
            </h2>
            <p className="text-[11px] text-amber-800/80 font-medium">
              {rows.length} lượt • Tổng cọc {formatVnd(totalDeposit)} (cần đối chiếu sao kê)
            </p>
          </div>
        </div>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`text-amber-800/70 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div id="reconciliation-body" className="px-4 pb-4 space-y-3 pt-1 border-t border-amber-200/60">
          <p className="text-xs text-amber-900 bg-white/70 border border-amber-200 rounded-xl p-3 leading-relaxed">
            Các lượt dưới đây đã được thu tiền <b>trước bản sửa lỗi tính cọc</b>. Khi đó tiền cọc luôn bị trừ vào số
            tiền thu (kể cả khi chưa thực nhận cọc), nên có thể đã <b>thu thiếu đúng bằng tiền cọc</b>. Hệ thống không tự
            sửa dữ liệu cũ — bạn có thể đối chiếu sao kê/ghi chép và xử lý tay nếu cần.
          </p>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.participantId}
                className="p-3 rounded-xl border border-amber-200/70 bg-white/80 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 block truncate">{r.name}</span>
                    <span className="text-[11px] text-slate-500 font-medium">{r.phone}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block">Cọc</span>
                    <span className="text-xs font-bold text-amber-700">{formatVnd(Number(r.depositAmount))}</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 font-medium truncate">
                  {r.sessionTitle}
                  {r.sessionStartTime && (
                    <> • {formatVnDate(r.sessionStartTime)}</>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
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
  const now = getVnParts(new Date())
  const [selectedYear, setSelectedYear] = useState<number>(() => now.year)
  const [selectedMonth, setSelectedMonth] = useState<number>(() => now.month)

  const { data: report, isLoading } = useQuery<MonthlyReport>({
    queryKey: ['monthly-report', selectedYear, selectedMonth],
    queryFn: async () => {
      const res = await api.get('/reports/monthly', {
        params: { year: selectedYear, month: selectedMonth },
      })
      return res.data
    },
    staleTime: 60_000,
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

  // Tìm ca đang diễn ra (ACTIVE) hoặc ca sắp tới gần nhất trong tháng
  const activeOrNextSession = React.useMemo(() => {
    if (!report?.sessionSummaries || report.sessionSummaries.length === 0) return null
    const active = report.sessionSummaries.find((s) => getEffectiveStatus(s) === 'ACTIVE')
    if (active) return active
    return report.sessionSummaries.find((s) => getEffectiveStatus(s) === 'UPCOMING') || null
  }, [report])

  const marginRate = report?.totalRevenue
    ? Math.round(((report.netProfit || 0) / report.totalRevenue) * 100)
    : 0

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 font-sans text-slate-900">
      {/* Linear Style Sub-header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-slate-900 text-white inline-flex">
              <ShieldCheck size={14} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Host Console
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 mt-1">
            Báo cáo vận hành CLB
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Dữ liệu tài chính, doanh thu ca đánh và cơ cấu thành viên theo tháng.
          </p>
        </div>

        {/* Linear Date Navigator */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-600 hover:text-slate-900"
              title="Tháng trước"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-3 py-0.5 text-center min-w-[100px]">
              <span className="text-xs font-semibold text-slate-800 tracking-tight tabular-nums">
                Tháng {selectedMonth.toString().padStart(2, '0')}/{selectedYear}
              </span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-600 hover:text-slate-900"
              title="Tháng sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => navigate('/host/create-session')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition active:scale-98"
          >
            <Plus size={14} />
            <span>Tạo ca mới</span>
          </button>
        </div>
      </div>

      {/* Quick-Access Live Session Alert: Tối giản, dạng Linear Notice */}
      {activeOrNextSession && (
        <div
          onClick={() => navigate(`/host/session/${activeOrNextSession.sessionId}`)}
          className="group relative bg-white border border-emerald-300/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-emerald-500 hover:shadow-sm transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="relative flex h-3 w-3 mt-1 sm:mt-0 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {getEffectiveStatus(activeOrNextSession) === 'ACTIVE' ? 'Ca đang diễn ra' : 'Ca tiếp theo'}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {activeOrNextSession.startTime ? formatVnDate(activeOrNextSession.startTime) : ''}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-950 group-hover:text-emerald-700 transition">
                {activeOrNextSession.title}
              </h2>
              <p className="text-xs text-slate-500">
                Quân số: <b className="text-slate-800">{activeOrNextSession.checkedInPlayers}/{activeOrNextSession.totalPlayers}</b> • Thu: <b className="text-emerald-700">{formatVnd(activeOrNextSession.totalRevenue)}</b>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition shrink-0 self-start sm:self-auto">
            <PlayCircle size={15} />
            <span>Mở điều hành ca</span>
          </div>
        </div>
      )}

      {/* Đối soát cọc (nếu có dữ liệu) */}
      <ReconciliationCard formatVnd={formatVnd} />

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/80 h-28" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/80 h-48" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Linear Minimalist KPI 4 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Lợi nhuận ròng (Net Profit) - Đặt lên số 1 */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Lợi nhuận ròng</span>
                <div className={`p-1.5 rounded-lg ${(report?.netProfit || 0) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {(report?.netProfit || 0) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </div>
              </div>
              <div className="space-y-1">
                <div className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${(report?.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatVnd(report?.netProfit)}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <span className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded ${marginRate >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {marginRate >= 0 ? `+${marginRate}%` : `${marginRate}%`}
                  </span>
                  <span>biên lợi nhuận</span>
                </div>
              </div>
            </div>

            {/* Doanh thu */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Tổng doanh thu</span>
                <div className="p-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
                  <CircleDollarSign size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-slate-950">
                  {formatVnd(report?.totalRevenue)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Cọc đã thu: <span className="font-semibold text-slate-700">{formatVnd(report?.totalDepositCollected)}</span>
                </div>
              </div>
            </div>

            {/* Chi phí */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Tổng chi phí</span>
                <div className="p-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
                  <Receipt size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-slate-900">
                  {formatVnd(report?.totalExpenses)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium truncate">
                  Sân: <b className="font-semibold text-slate-700">{formatVnd(report?.costCourt)}</b> • Cầu: <b className="font-semibold text-slate-700">{formatVnd(report?.costShuttlecock)}</b>
                </div>
              </div>
            </div>

            {/* Quy mô ca đánh & Điểm danh */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Quy mô ca & Điểm danh</span>
                <div className="p-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
                  <Users size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-slate-950">
                  {report?.totalSessions || 0} ca{' '}
                  <span className="text-xs font-normal text-slate-500">({report?.totalPlayerTurnout || 0} lượt)</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Tỷ lệ điểm danh: <span className="font-bold text-emerald-700">{report?.attendanceRate || 0}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Insights Grid (Linear Clean Surface) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Phân loại thành viên */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <PieChart size={15} className="text-slate-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Cơ cấu thành viên</h3>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">{report?.totalPlayerTurnout || 0} lượt</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Thành viên Cố định</span>
                    <span className="font-bold text-slate-900">{report?.fixedMemberTurnout || 0} lượt</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-slate-900 h-full rounded-full transition-all duration-500"
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
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Khách Vãng lai</span>
                    <span className="font-bold text-slate-900">{report?.guestTurnout || 0} lượt</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-slate-400 h-full rounded-full transition-all duration-500"
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

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Tỷ lệ giới tính:</span>
                  <span className="font-semibold text-slate-700">
                    {report?.maleTurnout || 0} Nam • {report?.femaleTurnout || 0} Nữ
                  </span>
                </div>
              </div>
            </div>

            {/* Phương thức thanh toán */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard size={15} className="text-slate-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Hình thức thanh toán</h3>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Đối soát</span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                      <CreditCard size={14} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block leading-tight">VietQR Tự Động</span>
                      <span className="text-[10px] text-slate-400 font-medium">Cổng SePay</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 tabular-nums">
                    {report?.vietQrPayments || 0} lượt
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                      <Banknote size={14} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block leading-tight">Tiền Mặt Trực Tiếp</span>
                      <span className="text-[10px] text-slate-400 font-medium">Thu tại sân</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-800 tabular-nums">
                    {report?.cashPayments || 0} lượt
                  </span>
                </div>

                {report?.unpaidCount ? (
                  <div className="text-[11px] text-rose-700 font-medium bg-rose-50 border border-rose-100 p-2 rounded-xl text-center">
                    ⚠️ Còn <b>{report.unpaidCount}</b> lượt chưa thanh toán trong tháng
                  </div>
                ) : null}
              </div>
            </div>

            {/* Top chiến thần năng nổ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Trophy size={15} className="text-amber-500" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top Thành Viên Năng Nổ</h3>
                </div>
                <span className="text-[10px] font-semibold text-slate-400">Tháng {selectedMonth}</span>
              </div>

              <div className="space-y-1.5">
                {report?.topPlayers && report.topPlayers.length > 0 ? (
                  report.topPlayers.slice(0, 4).map((p, idx) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 text-center text-xs font-bold text-slate-400">
                          {idx + 1}
                        </span>
                        <DuckMascot src={p.avatarUrl || '/duck-mascot.png'} size={24} rounded="full" />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-slate-900 block truncate max-w-[110px]">
                            {p.fullName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {p.membershipType === 'FIXED' ? 'Cố định' : 'Vãng lai'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-emerald-700 block tabular-nums">{p.winCount}W</span>
                        <span className="text-[10px] text-slate-400 tabular-nums">{p.lossCount}L</span>
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

          {/* Detailed Session Summaries Table / Clean Linear Data Sheet */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-950">
                  Lịch sử ca đánh ({selectedMonth}/{selectedYear})
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Bấm vào từng ca để mở Host Panel điều hành chi tiết
                </p>
              </div>
              <div className="text-xs text-slate-500 font-medium self-start sm:self-auto">
                Tổng cộng: <b className="text-slate-800">{report?.sessionSummaries?.length || 0} ca</b>
              </div>
            </div>

            {report?.sessionSummaries && report.sessionSummaries.length > 0 ? (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                {report.sessionSummaries.map((s) => {
                  const effStatus = getEffectiveStatus(s)
                  return (
                    <div
                      key={s.sessionId}
                      onClick={() => navigate(`/host/session/${s.sessionId}`)}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition cursor-pointer group"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition">
                            {s.title}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                              effStatus === 'COMPLETED'
                                ? 'bg-slate-100 text-slate-600'
                                : effStatus === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {effStatus === 'COMPLETED' ? 'Đã xong' : effStatus === 'ACTIVE' ? 'Đang diễn ra' : 'Sắp tới'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 text-[11px] text-slate-500 font-medium flex-wrap">
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
                          <span>Quân số: <b className="text-slate-700">{s.checkedInPlayers}/{s.totalPlayers}</b></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            Thu: <b className="text-slate-700 tabular-nums">{formatVnd(s.totalRevenue)}</b>
                          </div>
                          <div className="text-xs font-bold tabular-nums">
                            Lãi:{' '}
                            <span className={(s.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                              {formatVnd(s.netProfit)}
                            </span>
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold transition group-hover:bg-slate-900 group-hover:text-white">
                          <span>Chi tiết</span>
                          <ArrowUpRight size={13} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-white">
                <p className="text-xs text-slate-500 font-medium">Không có ca đánh nào trong tháng {selectedMonth}/{selectedYear}</p>
                <button
                  onClick={() => navigate('/host/create-session')}
                  className="mt-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
                >
                  Tạo ca đánh đầu tiên
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
