import React from 'react'
import { CheckCircle2, Circle, Loader2, MoreHorizontal } from 'lucide-react'
import { DuckMascot } from '../DuckMascot'
import { HostParticipant, PlayerSetStats, formatVnd, participantDisplayName, paymentMethodLabel } from './hostUtils'

interface RosterCardProps {
  participant: HostParticipant
  index: number
  stats: PlayerSetStats
  /** Có thao tác đang chờ server cho riêng người này */
  pending: boolean
  onCheckin: (p: HostParticipant) => void
  onRequestCancelCheckin: (p: HostParticipant) => void
  onSettle: (p: HostParticipant) => void
  onOpenMenu: (p: HostParticipant) => void
}

/** Thẻ điểm danh 1 người chơi cho màn hình điện thoại (dưới md) */
export const RosterCard: React.FC<RosterCardProps> = ({
  participant: p,
  index,
  stats,
  pending,
  onCheckin,
  onRequestCancelCheckin,
  onSettle,
  onOpenMenu,
}) => {
  const name = participantDisplayName(p, index)
  const isCheckedIn = p.checkinStatus === 'CHECKED_IN'
  const isAbsent = p.checkinStatus === 'ABSENT'
  const isPaid = p.paymentStatus === 'PAID'
  const hasDeposit = p.isGuest && Number(p.depositAmount) > 0 && p.depositStatus !== 'NONE'

  return (
    <article
      data-testid={`roster-card-${p.id}`}
      aria-label={name}
      aria-busy={pending || undefined}
      className={`rounded-2xl border bg-white p-3.5 space-y-3 shadow-xs ${
        isPaid ? 'border-emerald-200' : isCheckedIn ? 'border-slate-300' : 'border-slate-200'
      }`}
    >
      {/* Tên + nhãn + menu */}
      <div className="flex items-start gap-3">
        <DuckMascot
          src={p.avatarUrl || '/duck-mascot.png'}
          size={40}
          rounded="xl"
          className="shrink-0 border border-slate-200"
        />
        <div className="min-w-0 flex-1">
          <span className="font-black text-slate-950 text-base leading-snug block truncate">{name}</span>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            <span
              className={`text-[11px] px-2 py-0.5 rounded-md font-bold border ${
                p.gender === 'FEMALE'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {p.gender === 'FEMALE' ? 'Nữ' : 'Nam'}
            </span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-md font-bold border ${
                p.isGuest
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {p.isGuest ? 'Vãng lai' : 'Cố định'}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md font-bold border bg-slate-50 text-slate-700 border-slate-200">
              🏸 {stats.totalSets} set
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenMenu(p)}
          aria-label={`Thao tác khác cho ${name}`}
          className="min-h-11 min-w-11 -mr-1 -mt-1 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition shrink-0"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Thông tin quan trọng hiển thị trực tiếp (không giấu trong title) */}
      {(p.slotWindow || p.durationHours || p.adjustmentAmount !== 0 || hasDeposit || isAbsent) && (
        <div className="space-y-1 text-xs font-semibold">
          {p.slotWindow ? (
            <p className="text-slate-800">⏱️ Khung giờ: {p.slotWindow}</p>
          ) : p.durationHours ? (
            <p className="text-slate-800">⏱️ Đánh {p.durationHours}h</p>
          ) : null}
          {p.adjustmentAmount !== 0 && (
            <p className={p.adjustmentAmount < 0 ? 'text-rose-600' : 'text-amber-700'}>
              {p.adjustmentReason ? `🎁 ${p.adjustmentReason}: ` : 'Điều chỉnh: '}
              {p.adjustmentAmount > 0 ? '+' : ''}
              {formatVnd(p.adjustmentAmount)}
            </p>
          )}
          {hasDeposit && (
            <p
              className={
                p.depositStatus === 'PAID'
                  ? 'text-emerald-700'
                  : p.depositStatus === 'FORFEITED'
                  ? 'text-purple-700'
                  : 'text-amber-700'
              }
            >
              {p.depositStatus === 'PAID'
                ? `Đã nhận cọc ${formatVnd(p.depositAmount)}`
                : p.depositStatus === 'FORFEITED'
                ? 'Cọc đã vào quỹ'
                : p.depositStatus === 'REFUNDED'
                ? 'Đã hoàn cọc'
                : `Chờ duyệt cọc ${formatVnd(p.depositAmount)}`}
            </p>
          )}
          {isAbsent && <p className="text-rose-700">Đã hủy lượt (giữ cọc)</p>}
        </div>
      )}

      {/* Điểm danh + số tiền */}
      <div className="flex items-stretch gap-2">
        {!isAbsent && (
          <button
            type="button"
            aria-pressed={isCheckedIn}
            aria-label={`Điểm danh ${name}: ${isCheckedIn ? 'Đã đến' : 'Chưa đến'}`}
            disabled={pending}
            onClick={() => (isCheckedIn ? onRequestCancelCheckin(p) : onCheckin(p))}
            className={`min-h-12 flex-1 rounded-xl border-2 px-3 inline-flex items-center justify-center gap-2 text-sm font-black transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 ${
              isCheckedIn
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                : 'bg-white border-dashed border-slate-300 text-slate-600'
            }`}
          >
            {pending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : isCheckedIn ? (
              <>
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>Đã đến</span>
              </>
            ) : (
              <>
                <Circle size={18} className="text-slate-400" />
                <span>Chưa đến</span>
              </>
            )}
          </button>
        )}

        <div className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-right">
          <span className="block text-[11px] font-bold text-slate-500">{isPaid ? 'Đã thu' : 'Còn phải thu'}</span>
          <span className="block text-base font-black text-slate-950 font-mono">
            {formatVnd(isPaid ? p.finalFee : p.remainingAmount)}
          </span>
          {!isPaid && p.depositStatus === 'PAID' && Number(p.depositAmount) > 0 && (
            <span className="block text-[11px] font-semibold text-emerald-700">đã trừ cọc {formatVnd(p.depositAmount)}</span>
          )}
        </div>
      </div>

      {/* Thu tiền / trạng thái đã thu */}
      {isPaid ? (
        <div className="min-h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-black inline-flex items-center justify-center gap-1.5 w-full">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Đã thanh toán · {paymentMethodLabel(p.paymentMethod)}</span>
        </div>
      ) : !isAbsent ? (
        <button
          type="button"
          onClick={() => onSettle(p)}
          disabled={pending}
          className="min-h-12 w-full rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-black shadow-md transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          Thu tiền {formatVnd(p.remainingAmount)}
          {p.paymentMethod && (
            <span className="font-semibold text-white/70"> · khách chọn {paymentMethodLabel(p.paymentMethod)}</span>
          )}
        </button>
      ) : null}
    </article>
  )
}
