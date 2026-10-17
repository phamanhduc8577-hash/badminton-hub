import React from 'react'
import { AlertCircle } from 'lucide-react'
import { BottomSheet } from '../BottomSheet'

interface CancelSessionSheetProps {
  open: boolean
  onClose: () => void
  sessionTitle: string
  reason: string
  onReasonChange: (value: string) => void
  pending: boolean
  /** Thông báo lỗi từ server (vd. "Ca đã có người thanh toán…") */
  error?: string
  onConfirm: () => void
}

/** Xác nhận hủy ca (Host): lý do tùy chọn, nút xác nhận màu đỏ */
export const CancelSessionSheet: React.FC<CancelSessionSheetProps> = ({
  open,
  onClose,
  sessionTitle,
  reason,
  onReasonChange,
  pending,
  error,
  onConfirm,
}) => (
  <BottomSheet
    open={open}
    onClose={() => !pending && onClose()}
    closeOnBackdrop={!pending}
    title={`Hủy ca: ${sessionTitle}`}
    footer={
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="min-h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm sm:text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Giữ ca
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          aria-busy={pending}
          className="min-h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm sm:text-xs shadow-md transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {pending ? 'Đang hủy ca...' : 'Xác nhận hủy ca'}
        </button>
      </div>
    }
  >
    <div className="space-y-3 text-sm sm:text-xs text-slate-700 leading-relaxed">
      <ul className="list-disc pl-4 space-y-1">
        <li>Ca chuyển sang <b>Đã hủy</b>, thành viên không đăng ký thêm được.</li>
        <li>Các lượt chưa thanh toán bị hủy.</li>
        <li>
          Cọc đã nhận chuyển sang <b>Đã hoàn cọc</b> — Host tự chuyển trả tiền cho khách.
        </li>
        <li>Ca đã có người thanh toán: cần hoàn tác thu tiền trước khi hủy.</li>
      </ul>

      {error && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2 font-semibold"
        >
          <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label htmlFor="cancel-session-reason" className="block text-xs font-bold text-slate-700 mb-1.5">
          Lý do hủy (không bắt buộc)
        </label>
        <textarea
          id="cancel-session-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          maxLength={255}
          rows={2}
          placeholder="VD: Sân báo bảo trì, mưa lớn..."
          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-base text-slate-900 focus:outline-none focus:border-slate-900"
        />
      </div>
    </div>
  </BottomSheet>
)
