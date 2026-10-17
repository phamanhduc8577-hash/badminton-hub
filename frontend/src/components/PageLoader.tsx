import React from 'react'
import { Loader2 } from 'lucide-react'

/** Màn hình chờ nhỏ khi đang tải phần giao diện được tách file (lazy load) */
export const PageLoader: React.FC<{ label?: string; compact?: boolean }> = ({ label = 'Đang tải...', compact = false }) => (
  <div
    aria-busy="true"
    className={`flex items-center justify-center gap-2 text-slate-600 text-sm font-semibold ${compact ? 'py-6' : 'py-24'}`}
  >
    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
    <span>{label}</span>
  </div>
)
