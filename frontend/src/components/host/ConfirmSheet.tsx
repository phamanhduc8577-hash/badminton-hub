import React from 'react'
import { BottomSheet } from '../BottomSheet'

interface ConfirmSheetProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children?: React.ReactNode
  confirmLabel: string
  pendingLabel?: string
  cancelLabel?: string
  pending?: boolean
  destructive?: boolean
  onConfirm: () => void
}

/** Popup xác nhận dùng BottomSheet (thay cho window.confirm) */
export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  pendingLabel = 'Đang xử lý...',
  cancelLabel = 'Hủy',
  pending = false,
  destructive = false,
  onConfirm,
}) => (
  <BottomSheet
    open={open}
    onClose={() => !pending && onClose()}
    title={title}
    closeOnBackdrop={!pending}
    footer={
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="min-h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm sm:text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={`min-h-11 rounded-xl text-white font-black text-sm sm:text-xs shadow-md transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${
            destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-950 hover:bg-slate-800'
          }`}
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    }
  >
    {children && <div className="text-sm sm:text-xs text-slate-700 leading-relaxed space-y-3">{children}</div>}
  </BottomSheet>
)
