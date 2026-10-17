import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, X, AlertCircle, RotateCcw } from 'lucide-react'

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void
  onClose: () => void
  /** Mở thẳng form nhập mã tay (mặc định: chỉ đóng máy quét) */
  onManualEntry?: () => void
}

// Kích thước vùng quét (px) — khung ngắm hiển thị dùng đúng số này để khớp vùng nhận mã
const QR_BOX_SIZE = 220

export const QrCameraScanner: React.FC<QrScannerProps> = ({ onScanSuccess, onClose, onManualEntry }) => {
  const [error, setError] = useState<string>('')
  const [attempt, setAttempt] = useState(0)
  const scannerId = 'html5qr-code-full-region'

  // Giữ callback mới nhất trong ref để effect camera không bị khởi động lại mỗi lần cha render
  const onScanSuccessRef = useRef(onScanSuccess)
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess
  }, [onScanSuccess])

  useEffect(() => {
    let cancelled = false
    let handled = false
    const qrScanner = new Html5Qrcode(scannerId)

    const startPromise: Promise<unknown> = qrScanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: QR_BOX_SIZE, height: QR_BOX_SIZE },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (handled || cancelled) return
          handled = true
          const deliver = () => {
            if (!cancelled) onScanSuccessRef.current(decodedText)
          }
          qrScanner.stop().then(deliver, deliver)
        },
        () => {
          // Frame error (ignore scanning frames)
        }
      )
      .catch((err: unknown) => {
        if (cancelled) return
        const text = String((err as { name?: string })?.name || err || '')
        const denied = /NotAllowed|Permission/i.test(text)
        setError(
          denied
            ? 'Bạn chưa cho phép dùng camera. Hãy bật quyền camera cho trình duyệt rồi bấm "Thử lại", hoặc nhập mã bằng tay.'
            : 'Không thể mở camera. Vui lòng thử lại hoặc nhập mã thủ công.'
        )
      })

    return () => {
      cancelled = true
      // Đợi camera khởi động xong rồi mới tắt, tránh trường hợp đóng sớm mà camera vẫn sáng
      startPromise.then(() => {
        if (qrScanner.isScanning) {
          qrScanner.stop().catch(() => {})
        }
      })
    }
  }, [attempt])

  const handleRetry = () => {
    setError('')
    setAttempt((n) => n + 1)
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quét mã QR điểm danh"
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex flex-col items-center justify-center p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-4 relative overflow-hidden shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-sm">
            <Camera size={18} />
            <span>Quét Mã QR Sân</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="space-y-3">
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-2xl flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="w-full min-h-11 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} />
              <span>Thử lại</span>
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-slate-950 relative">
            <div id={scannerId} key={attempt} className="w-full h-72" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className="border-2 border-emerald-400/80 rounded-2xl border-dashed animate-pulse"
                style={{ width: QR_BOX_SIZE, height: QR_BOX_SIZE }}
              />
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-400">Hướng camera về phía mã QR trên màn hình Host</p>

        <button
          type="button"
          onClick={onManualEntry || onClose}
          className="w-full min-h-11 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm sm:text-xs"
        >
          Nhập mã bằng tay thay thế
        </button>
      </div>
    </div>,
    document.body
  )
}
