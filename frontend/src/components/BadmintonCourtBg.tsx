import React from 'react'

export const BadmintonCourtBg: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none bg-slate-50/50">
      {/* Clean Athletic Canvas Base */}
      <div className="absolute inset-0 bg-slate-50/60" />

      {/* Subtle Atmospheric Light Cone */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-white via-slate-100/40 to-transparent rounded-full blur-3xl pointer-events-none" />
    </div>
  )
}
