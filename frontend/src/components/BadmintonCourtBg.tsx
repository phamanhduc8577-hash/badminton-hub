import React from 'react'

export const BadmintonCourtBg: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* 1. High-End Editorial Off-White Solid Canvas */}
      <div className="absolute inset-0 bg-[#F4F6FA]" />

      {/* 2. New HD Wallpaper: Striking Badminton Player Poster (High Clarity & Definition) */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.24] mix-blend-multiply contrast-125 saturate-[0.9] transition-opacity duration-700"
        style={{ backgroundImage: "url('/badminton-bg-lol.jpg')" }}
      />

      {/* 3. Studio Dramatic Ambient Lighting Glows */}
      <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-white/80 rounded-full blur-[140px]" />
      <div className="absolute top-[30%] -right-[10%] w-[600px] h-[600px] bg-rose-500/[0.05] rounded-full blur-[160px]" />
      <div className="absolute bottom-[0%] -left-[10%] w-[700px] h-[700px] bg-indigo-500/[0.05] rounded-full blur-[160px]" />

      {/* 4. Fine Technical Grid Matrix */}
      <div className="absolute inset-0 bg-[radial-gradient(#475569_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.22] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_40%,#000_70%,transparent_100%)]" />

      {/* 5. Smooth Vignette Perimeter Softening */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F4F6FA]/10 to-[#F4F6FA]/70 pointer-events-none" />
    </div>
  )
}
