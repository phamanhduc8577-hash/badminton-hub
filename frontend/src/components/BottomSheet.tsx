import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  /** Vùng nút hành động dính đáy (luôn nhìn thấy, không bị cuộn mất) */
  footer?: React.ReactNode
  /** Chạm vào nền tối để đóng (mặc định: có) */
  closeOnBackdrop?: boolean
  /** id của phần tử làm tiêu đề khi không truyền `title` */
  labelledBy?: string
  /** Nhãn cho trình đọc màn hình khi không có tiêu đề hiển thị */
  ariaLabel?: string
  /** Class bổ sung cho phần thân cuộn được */
  bodyClassName?: string
  /** Class bổ sung cho khung popup */
  panelClassName?: string
}

// Nhiều sheet có thể chồng nhau: chỉ sheet trên cùng phản hồi phím Esc,
// và chỉ mở khóa cuộn trang khi sheet cuối cùng đóng.
const openStack: symbol[] = []
let savedBodyOverflow = ''

const lockBodyScroll = () => {
  if (openStack.length === 1) {
    savedBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}

const unlockBodyScroll = () => {
  if (openStack.length === 0) {
    document.body.style.overflow = savedBodyOverflow
  }
}

/**
 * Popup dùng chung cho mobile: trượt từ đáy màn hình, thân cuộn được, nút dính đáy,
 * chừa vùng thanh home iPhone. Từ màn hình sm trở lên hiển thị như modal giữa màn hình.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  closeOnBackdrop = true,
  labelledBy,
  ariaLabel,
  bodyClassName = '',
  panelClassName = '',
}) => {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const key = Symbol('bottom-sheet')
    openStack.push(key)
    lockBodyScroll()

    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus({ preventScroll: true })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openStack[openStack.length - 1] === key) {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      const idx = openStack.indexOf(key)
      if (idx >= 0) openStack.splice(idx, 1)
      unlockBodyScroll()
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [open])

  if (!open) return null

  const ariaLabelledBy = labelledBy ?? (title ? titleId : undefined)
  const safeAreaPadding = 'pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6'

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Đóng"
      className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
    >
      <X size={18} />
    </button>
  )

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div
        data-testid="bottom-sheet-backdrop"
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        tabIndex={-1}
        className={`relative w-full sm:max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden focus:outline-none animate-in slide-in-from-bottom-4 fade-in duration-200 ${panelClassName}`}
      >
        {/* Thanh kéo (chỉ trên mobile) */}
        <div className="sm:hidden flex justify-center pt-2.5 shrink-0" aria-hidden="true">
          <div className="h-1.5 w-10 rounded-full bg-slate-200" />
        </div>

        {title ? (
          <div className="flex items-start justify-between gap-2 pl-5 sm:pl-6 pr-2 sm:pr-3 pt-1 sm:pt-3 shrink-0">
            <h3 id={titleId} className="pt-2.5 font-black text-base text-slate-950 leading-snug min-w-0">
              {title}
            </h3>
            {closeButton}
          </div>
        ) : (
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10">{closeButton}</div>
        )}

        <div
          className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 ${title ? 'pt-3' : 'pt-4 sm:pt-6'} ${
            footer ? 'pb-4' : safeAreaPadding
          } ${bodyClassName}`}
        >
          {children}
        </div>

        {footer && (
          <div className={`shrink-0 border-t border-slate-100 bg-white px-5 sm:px-6 pt-3 ${safeAreaPadding}`}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
