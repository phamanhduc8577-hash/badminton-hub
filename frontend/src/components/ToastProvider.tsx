import React, { createContext, useContext, useState, useCallback } from 'react'
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

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Centered Modal / Floating Toast Banner */}
      {toasts.length > 0 && (
        <div className="fixed inset-0 z-9999 pointer-events-none flex flex-col items-center justify-center p-4">
          <div className="flex flex-col items-center gap-3 w-full max-w-sm pointer-events-auto">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={`w-full p-4.5 rounded-2xl shadow-2xl border flex items-center gap-3.5 animate-in zoom-in-95 fade-in slide-in-from-bottom-3 duration-250 backdrop-blur-md ${
                  toast.type === 'error'
                    ? 'bg-rose-950/95 text-white border-rose-600/60 shadow-rose-950/40'
                    : toast.type === 'info'
                    ? 'bg-slate-900/95 text-white border-slate-700/60 shadow-slate-950/40'
                    : 'bg-emerald-950/95 text-white border-emerald-500/60 shadow-emerald-950/40'
                }`}
              >
                <div className="shrink-0 p-2 rounded-xl bg-white/10">
                  {toast.type === 'error' ? (
                    <AlertCircle size={22} className="text-rose-400" />
                  ) : toast.type === 'info' ? (
                    <Info size={22} className="text-blue-400" />
                  ) : (
                    <CheckCircle2 size={22} className="text-emerald-400" />
                  )}
                </div>

                <div className="flex-1 text-xs sm:text-sm font-bold leading-snug">
                  {toast.message}
                </div>

                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
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
