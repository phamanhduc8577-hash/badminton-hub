import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, X, AlertCircle } from 'lucide-react'

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void
  onClose: () => void
}

export const QrCameraScanner: React.FC<QrScannerProps> = ({ onScanSuccess, onClose }) => {
  const [error, setError] = useState<string>('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerId = 'html5qr-code-full-region'

  useEffect(() => {
    const qrScanner = new Html5Qrcode(scannerId)
    scannerRef.current = qrScanner

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    }

    qrScanner
      .start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          qrScanner
            .stop()
            .then(() => {
              onScanSuccess(decodedText)
            })
            .catch(() => {
              onScanSuccess(decodedText)
            })
        },
        () => {
          // Frame error (ignore scanning frames)
        }
      )
      .catch((err) => {
        setError('Không thể mở camera. Vui lòng cho phép quyền camera hoặc nhập mã thủ công.')
      })

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [onScanSuccess])

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-4 relative overflow-hidden shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-sm">
            <Camera size={18} />
            <span>Quét Mã QR Sân</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {error ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-2xl flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-slate-950 relative">
            <div id={scannerId} className="w-full h-64" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-emerald-400/80 rounded-2xl border-dashed animate-pulse" />
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-400">
          Hướng camera về phía mã QR trên màn hình Host
        </p>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
        >
          Nhập mã bằng tay thay thế
        </button>
      </div>
    </div>
  )
}
