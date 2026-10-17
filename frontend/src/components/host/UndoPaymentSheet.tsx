import React, { useId, useState } from 'react'
import { BottomSheet } from '../BottomSheet'
import { HostParticipant, UNDO_PAYMENT_REASONS, formatVnd, participantDisplayName, paymentMethodLabel } from './hostUtils'

interface UndoPaymentSheetProps {
  participant: HostParticipant | null
  onClose: () => void
  onSubmit: (reason: string) => void
  pending?: boolean
}

/** Hoàn tác thu tiền: bắt buộc chọn/nhập lý do (gửi kèm Telegram ở server) */
export const UndoPaymentSheet: React.FC<UndoPaymentSheetProps> = (props) =>
  // key theo người chơi → mỗi lần mở cho 1 người khác thì lý do được làm mới
  props.participant ? <UndoPaymentSheetContent key={props.participant.id} {...props} participant={props.participant} /> : null

const UndoPaymentSheetContent: React.FC<UndoPaymentSheetProps & { participant: HostParticipant }> = ({
  participant,
  onClose,
  onSubmit,
  pending = false,
}) => {
  const [reason, setReason] = useState('')
  const inputId = useId()
  const trimmed = reason.trim()

  return (
    <BottomSheet
      open
      onClose={() => !pending && onClose()}
      closeOnBackdrop={!pending}
      title={`Hoàn tác thu tiền: ${participantDisplayName(participant)}`}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="min-h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm sm:text-xs transition disabled:opacity-50"
          >
            Không hoàn tác
          </button>
          <button
            type="button"
            disabled={!trimmed || pending}
            onClick={() => onSubmit(trimmed)}
            className="min-h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-sm sm:text-xs shadow-md transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {pending ? 'Đang hoàn tác...' : 'Xác nhận hoàn tác'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm sm:text-xs text-slate-700">
        <p className="leading-relaxed">
          Lượt đã thu <b className="text-slate-950">{formatVnd(participant.finalFee)}</b> (
          {paymentMethodLabel(participant.paymentMethod)}) sẽ chuyển về <b>chưa thanh toán</b>. Doanh thu ca được tính
          lại và Host nhận thông báo Telegram.
        </p>

        <fieldset className="space-y-2">
          <legend className="font-bold text-slate-900 mb-2">Lý do hoàn tác (bắt buộc)</legend>
          <div className="flex flex-wrap gap-2">
            {UNDO_PAYMENT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={trimmed === r}
                onClick={() => setReason(r)}
                className={`min-h-11 px-3.5 rounded-full border text-sm sm:text-xs font-bold transition ${
                  trimmed === r
                    ? 'bg-slate-950 text-white border-slate-950'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor={inputId} className="block font-bold text-slate-900 mb-1.5">
            Hoặc nhập lý do khác
          </label>
          <input
            id={inputId}
            type="text"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Khách chuyển nhầm tài khoản"
            className="w-full min-h-11 border border-slate-300 rounded-xl px-3 text-base text-slate-900 font-medium focus:outline-none focus:border-slate-900"
          />
          {!trimmed && <p className="mt-1.5 text-xs text-slate-500">Chọn 1 lý do có sẵn hoặc nhập lý do để tiếp tục.</p>}
        </div>
      </div>
    </BottomSheet>
  )
}
