import React, { useEffect, useRef } from 'react'
import { Undo2, X } from 'lucide-react'

interface UndoSnackbarProps {
  /** Khóa duy nhất cho mỗi lần hiển thị (đổi khóa → đếm lại thời gian) */
  snackKey: string | number | null
  message: string
  onUndo: () => void
  onDismiss: () => void
  pending?: boolean
  durationMs?: number
}

/**
 * Thanh thông báo có nút "Hoàn tác" (ToastProvider chưa hỗ trợ nút hành động).
 * Nằm phía trên thanh menu dưới của mobile, tự ẩn sau `durationMs`.
 */
export const UndoSnackbar: React.FC<UndoSnackbarProps> = ({
  snackKey,
  message,
  onUndo,
  onDismiss,
  pending = false,
  durationMs = 5000,
}) => {
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (snackKey === null || pending) return
    const t = setTimeout(() => dismissRef.current(), durationMs)
    return () => clearTimeout(t)
  }, [snackKey, durationMs, pending])

  if (snackKey === null) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 z-40 flex justify-center px-3 pointer-events-none bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6"
    >
      <div className="pointer-events-auto w-full max-w-md flex items-center gap-2 pl-4 pr-1.5 py-1.5 rounded-2xl bg-slate-950/95 text-white shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
        <span className="flex-1 text-sm font-bold leading-snug py-1.5">{message}</span>
        <button
          type="button"
          onClick={onUndo}
          disabled={pending}
          className="min-h-11 px-3.5 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black transition active:scale-95 disabled:opacity-60"
        >
          <Undo2 size={16} />
          <span>{pending ? 'Đang hoàn tác...' : 'Hoàn tác'}</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Đóng thông báo hoàn tác"
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
