import React, { useId, useState } from 'react'
import { BottomSheet } from '../BottomSheet'
import { CurrencyInput } from '../CurrencyInput'
import { HostParticipant, formatVnd, participantDisplayName } from './hostUtils'

export interface OverrideBillPayload {
  participantId: number
  overrideBaseFee: number
  adjustmentAmount: number
  adjustmentReason: string
}

interface OverrideBillSheetProps {
  participant: HostParticipant | null
  onClose: () => void
  onSubmit: (payload: OverrideBillPayload) => void
  pending?: boolean
}

const voucherPercent = (reason: string) => {
  const m = reason.match(/Voucher\s+(\d+)%/i)
  return m ? parseInt(m[1], 10) : null
}

/** Sửa hóa đơn 1 lượt: giá gốc + điều chỉnh (giảm / phụ thu) + lý do */
export const OverrideBillSheet: React.FC<OverrideBillSheetProps> = (props) =>
  // key theo người chơi → mở cho người khác thì form được khởi tạo lại từ hóa đơn hiện tại
  props.participant ? <OverrideBillSheetContent key={props.participant.id} {...props} participant={props.participant} /> : null

const OverrideBillSheetContent: React.FC<OverrideBillSheetProps & { participant: HostParticipant }> = ({
  participant,
  onClose,
  onSubmit,
  pending = false,
}) => {
  const initialAdj = participant.adjustmentAmount || 0
  const [baseFee, setBaseFee] = useState(participant.baseFee || participant.finalFee || 0)
  // Dấu tách riêng khỏi số tiền: đổi dấu không tự chèn số tiền mặc định
  const [sign, setSign] = useState<1 | -1>(initialAdj > 0 ? 1 : -1)
  const [amount, setAmount] = useState(Math.abs(initialAdj))
  const [reason, setReason] = useState(participant.adjustmentReason || '')
  const reasonId = useId()
  const baseId = useId()
  const amountId = useId()

  const adjustment = sign * amount
  const newFinal = Math.max(0, baseFee + adjustment)

  const applyBase = (val: number) => {
    setBaseFee(val)
    // Tự tính lại số tiền giảm nếu đang áp voucher %
    const pct = voucherPercent(reason)
    if (pct !== null) {
      setSign(-1)
      setAmount(Math.round((val * pct) / 100))
    }
  }

  const signButton = (value: 1 | -1, label: string) => (
    <button
      type="button"
      aria-pressed={sign === value}
      onClick={() => setSign(value)}
      className={`min-h-11 rounded-xl font-bold text-sm sm:text-xs border transition ${
        sign === value
          ? value < 0
            ? 'bg-rose-50 text-rose-700 border-rose-300'
            : 'bg-emerald-50 text-emerald-700 border-emerald-300'
          : 'bg-white text-slate-600 border-slate-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <BottomSheet
      open
      onClose={() => !pending && onClose()}
      closeOnBackdrop={!pending}
      title={`Sửa hóa đơn: ${participantDisplayName(participant)}`}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="min-h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm sm:text-xs transition disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              onSubmit({
                participantId: participant.id,
                overrideBaseFee: baseFee,
                adjustmentAmount: adjustment,
                adjustmentReason: reason.trim(),
              })
            }
            className="min-h-11 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-sm sm:text-xs shadow-md transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {pending ? 'Đang lưu...' : 'Lưu điều chỉnh'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm sm:text-xs">
        <div>
          <label htmlFor={baseId} className="block text-slate-700 font-bold mb-1.5">
            Giá gốc ca đánh (VD: 95.000đ giảm còn 75.000đ khi về sớm)
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <CurrencyInput id={baseId} value={baseFee} onChange={applyBase} placeholder="95000" />
            </div>
            {participant.baseFee !== baseFee && (
              <button
                type="button"
                onClick={() => applyBase(participant.baseFee || 0)}
                className="min-h-11 px-3 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Đặt lại
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-slate-700 font-bold">Điều chỉnh</span>
          {/* Nút đổi dấu nằm riêng 1 dòng, không tự chèn số tiền */}
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Loại điều chỉnh">
            {signButton(-1, '− Giảm tiền')}
            {signButton(1, '+ Phụ thu')}
          </div>
          <label htmlFor={amountId} className="sr-only">
            Số tiền điều chỉnh
          </label>
          <CurrencyInput id={amountId} value={amount} onChange={setAmount} placeholder="0" />
        </div>

        <div>
          <label htmlFor={reasonId} className="block text-slate-700 font-bold mb-1.5">
            Lý do điều chỉnh / Ghi chú
          </label>
          <input
            id={reasonId}
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Về sớm 1 tiếng / Áp dụng Voucher 15%..."
            className="w-full min-h-11 border border-slate-300 rounded-xl px-3 text-base text-slate-900 focus:outline-none focus:border-slate-900 font-medium"
          />
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Giá gốc áp dụng:</span>
            <span className="font-bold text-slate-900">{formatVnd(baseFee)}</span>
          </div>
          {adjustment !== 0 && (
            <div className={`flex justify-between font-bold ${adjustment < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              <span>{reason.trim() || (adjustment < 0 ? 'Giảm trừ' : 'Phụ thu')}:</span>
              <span>
                {adjustment > 0 ? '+' : ''}
                {formatVnd(adjustment)}
              </span>
            </div>
          )}
          <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-950">
            <span>Thành tiền mới:</span>
            <span className="font-mono text-emerald-700">{formatVnd(newFinal)}</span>
          </div>
          {participant.depositStatus === 'PAID' && Number(participant.depositAmount) > 0 && (
            <p className="text-emerald-700 font-semibold">
              Đã nhận cọc {formatVnd(participant.depositAmount)} — server tự trừ cọc khi tính số tiền còn phải thu.
            </p>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
