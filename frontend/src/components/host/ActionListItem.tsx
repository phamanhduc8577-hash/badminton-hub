import React from 'react'

interface ActionListItemProps {
  icon: React.ReactNode
  label: string
  hint?: string | null
  disabled?: boolean
  destructive?: boolean
  onClick: () => void
}

/** 1 dòng trong danh sách thao tác của BottomSheet (vùng bấm ≥ 48px) */
export const ActionListItem: React.FC<ActionListItemProps> = ({ icon, label, hint, disabled, destructive, onClick }) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full min-h-12 px-3 py-2 rounded-xl flex items-center gap-3 text-left transition disabled:cursor-not-allowed ${
        destructive
          ? 'text-rose-700 hover:bg-rose-50 disabled:text-rose-300 disabled:hover:bg-transparent'
          : 'text-slate-900 hover:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-transparent'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        {hint && <span className="block text-xs font-medium text-slate-500">{hint}</span>}
      </span>
    </button>
  </li>
)

/** Đường kẻ ngăn cách thao tác nguy hiểm (luôn nằm cuối danh sách) */
export const ActionListDivider: React.FC = () => <li aria-hidden="true" className="border-t border-slate-100 my-2" />
