import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = `${Date.now()}-${Math.random()}`
      setToasts((prev) => [...prev, { id, message, type }])
      timersRef.current.set(
        id,
        setTimeout(() => removeToast(id), type === 'error' ? 4500 : 3200)
      )
    },
    [removeToast]
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  // Giữ nguyên object context giữa các lần render → component dùng useToast không render lại mỗi khi có toast
  const contextValue = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast nổi ở mép trên (chừa tai thỏ / Dynamic Island), không che nút hành động ở giữa / đáy màn hình */}
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 top-0 z-9999 pointer-events-none flex flex-col items-center px-3 sm:px-4 pt-[max(1rem,env(safe-area-inset-top))]"
      >
        <div className="flex flex-col items-center gap-2.5 w-full max-w-sm">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto w-full pl-4 pr-1.5 py-2 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-250 backdrop-blur-md ${
                toast.type === 'error'
                  ? 'bg-rose-950/95 text-white border-rose-600/60 shadow-rose-950/40'
                  : toast.type === 'info'
                  ? 'bg-slate-900/95 text-white border-slate-700/60 shadow-slate-950/40'
                  : 'bg-emerald-950/95 text-white border-emerald-500/60 shadow-emerald-950/40'
              }`}
            >
              <div className="shrink-0 p-2 rounded-xl bg-white/10">
                {toast.type === 'error' ? (
                  <AlertCircle size={20} className="text-rose-400" />
                ) : toast.type === 'info' ? (
                  <Info size={20} className="text-blue-400" />
                ) : (
                  <CheckCircle2 size={20} className="text-emerald-400" />
                )}
              </div>

              <div className="flex-1 text-xs sm:text-sm font-bold leading-snug py-1.5">{toast.message}</div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Đóng thông báo"
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    // Fallback if not inside provider
    return {
      showToast: (msg: string) => alert(msg),
    }
  }
  return context
}
