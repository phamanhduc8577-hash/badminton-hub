import React from 'react'

interface GiftGraphicProps {
  type: string
  isReached: boolean
  isClaimed?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export const GiftGraphic: React.FC<GiftGraphicProps> = ({
  type,
  isReached,
  isClaimed = false,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-14 h-14',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
    xl: 'w-36 h-36',
  }

  // If locked, render Mystery Box
  if (!isReached) {
    return (
      <div
        className={`relative ${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 flex items-center justify-center border border-slate-300 shadow-inner group-hover:scale-105 transition duration-300 ${className}`}
      >
        <svg viewBox="0 0 100 100" className="w-4/5 h-4/5 drop-shadow-sm opacity-60">
          {/* Mystery Box Base */}
          <rect x="20" y="38" width="60" height="48" rx="6" fill="#94A3B8" />
          <rect x="16" y="28" width="68" height="14" rx="4" fill="#64748B" />
          {/* Ribbon */}
          <rect x="44" y="28" width="12" height="58" fill="#F43F5E" opacity="0.8" />
          <path
            d="M 50 28 C 42 16 32 18 36 26 C 40 32 50 28 50 28 Z"
            fill="#F43F5E"
            opacity="0.85"
          />
          <path
            d="M 50 28 C 58 16 68 18 64 26 C 60 32 50 28 50 28 Z"
            fill="#F43F5E"
            opacity="0.85"
          />
          {/* Lock icon */}
          <circle cx="50" cy="62" r="10" fill="#1E293B" />
          <rect x="47" y="59" width="6" height="7" fill="#F8FAFC" rx="1" />
          <path
            d="M 46 59 A 4 4 0 0 1 54 59"
            stroke="#F8FAFC"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>
    )
  }

  // Render Realistic Visuals based on Gift Type
  switch (type) {
    case 'REVIVE':
    case 'REVIVE_2':
    case 'REVIVE_3':
      const bottleCount = type === 'REVIVE_3' ? 3 : type === 'REVIVE_2' ? 2 : 1
      return (
        <div
          className={`relative ${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-100 to-amber-200 border border-amber-300 shadow-md flex items-center justify-center p-2 group-hover:scale-105 transition duration-300 overflow-hidden ${className}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-300/30 via-transparent to-transparent pointer-events-none" />
          <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="reviveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="35%" stopColor="#0284C7" />
                <stop offset="70%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#EF4444" />
              </linearGradient>
              <linearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>

            {bottleCount === 3 && (
              <g transform="translate(18, 0) scale(0.85)" opacity="0.8">
                <rect x="42" y="10" width="16" height="8" rx="2" fill="url(#capGrad)" />
                <rect x="45" y="18" width="10" height="8" fill="#CBD5E1" />
                <path d="M 45 26 Q 34 38 34 50 L 34 100 Q 34 108 42 108 L 58 108 Q 66 108 66 100 L 66 50 Q 66 38 55 26 Z" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.5" />
                <rect x="35" y="52" width="30" height="38" rx="3" fill="url(#reviveGrad)" />
              </g>
            )}

            {bottleCount >= 2 && (
              <g transform="translate(-18, 0) scale(0.85)" opacity="0.8">
                <rect x="42" y="10" width="16" height="8" rx="2" fill="url(#capGrad)" />
                <rect x="45" y="18" width="10" height="8" fill="#CBD5E1" />
                <path d="M 45 26 Q 34 38 34 50 L 34 100 Q 34 108 42 108 L 58 108 Q 66 108 66 100 L 66 50 Q 66 38 55 26 Z" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.5" />
                <rect x="35" y="52" width="30" height="38" rx="3" fill="url(#reviveGrad)" />
              </g>
            )}

            {/* Main Center Bottle */}
            <g transform={bottleCount > 1 ? 'translate(10, 0)' : 'translate(10, 0)'}>
              {/* Bottle Cap */}
              <rect x="40" y="8" width="20" height="10" rx="2.5" fill="url(#capGrad)" stroke="#B45309" strokeWidth="0.8" />
              {/* Neck */}
              <rect x="44" y="18" width="12" height="10" fill="#E2E8F0" />
              {/* Body */}
              <path
                d="M 44 28 Q 30 42 30 56 L 30 102 Q 30 112 40 112 L 60 112 Q 70 112 70 102 L 70 56 Q 70 42 56 28 Z"
                fill="#BAE6FD"
                stroke="#0284C7"
                strokeWidth="2"
              />
              {/* Revive Label */}
              <rect x="31" y="52" width="38" height="44" rx="4" fill="url(#reviveGrad)" />
              <text x="50" y="68" fill="#FFFFFF" fontSize="9" fontWeight="900" textAnchor="middle" letterSpacing="0.5">
                REVIVE
              </text>
              <text x="50" y="78" fill="#FEF08A" fontSize="6.5" fontWeight="800" textAnchor="middle">
                ISOTONIC
              </text>
              <polygon points="50,81 48,87 51,87 49,93 54,86 51,86" fill="#FDE047" />
              {/* Droplets / bubbles */}
              <circle cx="36" cy="40" r="1.5" fill="#FFFFFF" opacity="0.8" />
              <circle cx="64" cy="48" r="2" fill="#FFFFFF" opacity="0.8" />
              <circle cx="36" cy="102" r="1.8" fill="#FFFFFF" opacity="0.6" />
            </g>
          </svg>
          {bottleCount > 1 && (
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-amber-900 text-white font-black text-[9px] shadow-sm">
              x{bottleCount}
            </span>
          )}
        </div>
      )

    case 'GRIP_1':
    case 'GRIP_2':
    case 'GRIP_3':
      const gripCount = type === 'GRIP_3' ? 3 : type === 'GRIP_2' ? 2 : 1
      return (
        <div
          className={`relative ${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-100 to-emerald-200 border border-emerald-300 shadow-md flex items-center justify-center p-2 group-hover:scale-105 transition duration-300 overflow-hidden ${className}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-300/20 via-transparent to-transparent pointer-events-none" />
          <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="gripGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="gripGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#0E7490" />
              </linearGradient>
              <linearGradient id="gripGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F43F5E" />
                <stop offset="100%" stopColor="#BE123C" />
              </linearGradient>
              <linearGradient id="tapeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0F172A" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>
            </defs>

            {/* Grip Roll 1 */}
            <g transform={gripCount === 1 ? 'translate(25, 20)' : gripCount === 2 ? 'translate(10, 20)' : 'translate(0, 25)'}>
              {/* Main Roll Body */}
              <rect x="15" y="15" width="40" height="48" rx="8" fill="url(#gripGrad1)" stroke="#065F46" strokeWidth="1.5" />
              {/* Winding Layers */}
              <line x1="15" y1="26" x2="55" y2="26" stroke="#047857" strokeWidth="2" />
              <line x1="15" y1="38" x2="55" y2="38" stroke="#047857" strokeWidth="2" />
              <line x1="15" y1="50" x2="55" y2="50" stroke="#047857" strokeWidth="2" />
              {/* Grip Logo Tape */}
              <rect x="12" y="32" width="46" height="12" rx="3" fill="url(#tapeGrad)" stroke="#64748B" strokeWidth="0.8" />
              <text x="35" y="41" fill="#F8FAFC" fontSize="5.5" fontWeight="900" textAnchor="middle" letterSpacing="0.8">
                SUPER GRIP
              </text>
            </g>

            {/* Grip Roll 2 (if 2 or 3) */}
            {gripCount >= 2 && (
              <g transform={gripCount === 2 ? 'translate(45, 30)' : 'translate(35, 10)'}>
                <rect x="15" y="15" width="38" height="46" rx="8" fill="url(#gripGrad2)" stroke="#155E75" strokeWidth="1.5" />
                <line x1="15" y1="26" x2="53" y2="26" stroke="#0E7490" strokeWidth="2" />
                <line x1="15" y1="38" x2="53" y2="38" stroke="#0E7490" strokeWidth="2" />
                <rect x="12" y="31" width="44" height="12" rx="3" fill="url(#tapeGrad)" />
                <text x="34" y="40" fill="#F8FAFC" fontSize="5.5" fontWeight="900" textAnchor="middle">
                  TACKY PU
                </text>
              </g>
            )}

            {/* Grip Roll 3 (if 3) */}
            {gripCount === 3 && (
              <g transform="translate(55, 35)">
                <rect x="15" y="15" width="38" height="46" rx="8" fill="url(#gripGrad3)" stroke="#9F1239" strokeWidth="1.5" />
                <line x1="15" y1="26" x2="53" y2="26" stroke="#BE123C" strokeWidth="2" />
                <line x1="15" y1="38" x2="53" y2="38" stroke="#BE123C" strokeWidth="2" />
                <rect x="12" y="31" width="44" height="12" rx="3" fill="url(#tapeGrad)" />
                <text x="34" y="40" fill="#F8FAFC" fontSize="5.5" fontWeight="900" textAnchor="middle">
                  YONEX AC
                </text>
              </g>
            )}
          </svg>
          {gripCount > 1 && (
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-200 font-black text-[9px] shadow-sm">
              x{gripCount} cuộn
            </span>
          )}
        </div>
      )

    case 'DISCOUNT_15':
    case 'DISCOUNT_20':
    case 'DISCOUNT_25':
    case 'DISCOUNT_30':
    case 'DISCOUNT_35':
    case 'DISCOUNT_38':
    case 'DISCOUNT_40':
      const discountPct = type.replace('DISCOUNT_', '')
      return (
        <div
          className={`relative ${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-rose-50 via-red-100 to-amber-100 border border-rose-300 shadow-md flex items-center justify-center p-2 group-hover:scale-105 transition duration-300 overflow-hidden ${className}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-rose-400/20 via-transparent to-transparent pointer-events-none" />
          <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="voucherGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0F172A" />
                <stop offset="40%" stopColor="#1E293B" />
                <stop offset="100%" stopColor="#0F172A" />
              </linearGradient>
              <linearGradient id="goldText" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#FBBF24" />
              </linearGradient>
            </defs>

            {/* Ticket Shape with side notches */}
            <path
              d="M 15 25 Q 15 20 20 20 L 100 20 Q 105 20 105 25 L 105 50 A 10 10 0 0 0 105 70 L 105 95 Q 105 100 100 100 L 20 100 Q 15 100 15 95 L 15 70 A 10 10 0 0 0 15 50 Z"
              fill="url(#voucherGrad)"
              stroke="#F59E0B"
              strokeWidth="2"
            />

            {/* Ticket Dashed Perforation */}
            <line x1="80" y1="22" x2="80" y2="98" stroke="#64748B" strokeWidth="1.5" strokeDasharray="3 3" />

            {/* Header / Brand */}
            <text x="24" y="36" fill="#94A3B8" fontSize="7" fontWeight="900" letterSpacing="0.8">
              SMASHFLOW VOUCHER
            </text>

            {/* Big Discount Value */}
            <text x="48" y="70" fill="url(#goldText)" fontSize="30" fontWeight="900" textAnchor="middle" letterSpacing="-1">
              -{discountPct}%
            </text>

            {/* Subtext */}
            <text x="48" y="85" fill="#E2E8F0" fontSize="7" fontWeight="800" textAnchor="middle">
              GIẢM TIỀN SÂN
            </text>

            {/* Right Stub Info */}
            <g transform="translate(86, 32)">
              <text x="5" y="16" fill="#FDE047" fontSize="7" fontWeight="900">
                VIP
              </text>
              <text x="5" y="32" fill="#94A3B8" fontSize="5.5" fontWeight="700">
                TICKET
              </text>
              <rect x="4" y="42" width="10" height="12" fill="#334155" rx="1" />
              <line x1="6" y1="45" x2="12" y2="45" stroke="#94A3B8" strokeWidth="1" />
              <line x1="6" y1="48" x2="12" y2="48" stroke="#94A3B8" strokeWidth="1" />
              <line x1="6" y1="51" x2="12" y2="51" stroke="#94A3B8" strokeWidth="1" />
            </g>
          </svg>
        </div>
      )

    case 'YONEX_SOCKS':
      return (
        <div
          className={`relative ${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-100 to-rose-100 border-2 border-amber-400 shadow-xl shadow-amber-400/20 flex items-center justify-center p-2 group-hover:scale-105 transition duration-300 overflow-hidden ${className}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-300/30 via-transparent to-transparent pointer-events-none" />
          <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="sockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="70%" stopColor="#F1F5F9" />
                <stop offset="100%" stopColor="#E2E8F0" />
              </linearGradient>
              <linearGradient id="yonexBlue" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0284C7" />
                <stop offset="100%" stopColor="#0369A1" />
              </linearGradient>
              <linearGradient id="yonexGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>

            {/* Shadow Sock */}
            <g transform="translate(14, -4) scale(0.95)" opacity="0.7">
              <path
                d="M 35 15 L 65 15 L 65 65 Q 65 75 75 85 L 95 95 Q 102 99 98 106 Q 92 112 80 108 L 50 88 Q 35 78 35 60 Z"
                fill="#CBD5E1"
                stroke="#94A3B8"
                strokeWidth="2"
              />
            </g>

            {/* Main Yonex Sock */}
            <g transform="translate(0, 0)">
              {/* Sock Body */}
              <path
                d="M 35 15 L 65 15 L 65 65 Q 65 75 75 85 L 95 95 Q 104 99 100 107 Q 94 113 80 108 L 50 88 Q 35 78 35 60 Z"
                fill="url(#sockGrad)"
                stroke="#0F172A"
                strokeWidth="2.5"
              />

              {/* Top Elastic Ribbed Cuff */}
              <rect x="35" y="15" width="30" height="8" fill="#0F172A" />
              <line x1="40" y1="15" x2="40" y2="23" stroke="#94A3B8" strokeWidth="1" />
              <line x1="45" y1="15" x2="45" y2="23" stroke="#94A3B8" strokeWidth="1" />
              <line x1="50" y1="15" x2="50" y2="23" stroke="#94A3B8" strokeWidth="1" />
              <line x1="55" y1="15" x2="55" y2="23" stroke="#94A3B8" strokeWidth="1" />
              <line x1="60" y1="15" x2="60" y2="23" stroke="#94A3B8" strokeWidth="1" />

              {/* Yonex Iconic Double Stripes (Blue & Green) */}
              <rect x="35" y="27" width="30" height="5" fill="url(#yonexBlue)" />
              <rect x="35" y="34" width="30" height="5" fill="url(#yonexGreen)" />

              {/* Yonex Logo Text */}
              <text x="50" y="52" fill="#0F172A" fontSize="7" fontWeight="900" textAnchor="middle" letterSpacing="0.8">
                YONEX
              </text>

              {/* Heel & Toe Reinforced Cushions */}
              <path d="M 35 65 Q 35 80 50 85 Z" fill="#E2E8F0" />
              <path d="M 90 92 Q 104 98 100 107 Q 92 110 82 105 Z" fill="#0F172A" />
            </g>

            {/* Gold 100 Milestone Stamp */}
            <circle cx="28" cy="98" r="14" fill="#F59E0B" stroke="#FEF08A" strokeWidth="2" />
            <text x="28" y="102" fill="#FFFFFF" fontSize="9" fontWeight="900" textAnchor="middle">
              100
            </text>
          </svg>
          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[9px] shadow-sm">
            TOP REWARD
          </span>
        </div>
      )

    default:
      return (
        <div
          className={`relative ${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100 border border-amber-300 shadow-md flex items-center justify-center text-4xl group-hover:scale-105 transition duration-300 ${className}`}
        >
          🎁
        </div>
      )
  }
}
