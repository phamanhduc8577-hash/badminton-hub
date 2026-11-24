import React from 'react'

export interface Shuttlecock3DProps {
  size?: number
  className?: string
  animated?: boolean
  showShadow?: boolean
}

export const Shuttlecock3D: React.FC<Shuttlecock3DProps> = ({
  size = 180,
  className = '',
  animated = true,
  showShadow = true,
}) => {
  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none pointer-events-none ${className}`}
      style={{ width: size, height: size * 1.25 }}
    >
      {/* 3D Floating Container */}
      <div
        className={`relative z-10 w-full h-full flex items-center justify-center ${
          animated ? 'animate-[floatShuttlecock_4.5s_ease-in-out_infinite]' : ''
        }`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <svg
          viewBox="0 0 200 240"
          width={size}
          height={size * 1.2}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="filter drop-shadow-xl"
        >
          <defs>
            {/* Gradients for Feathers */}
            <linearGradient id="featherGrad1" x1="100" y1="20" x2="100" y2="150" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="65%" stopColor="#F1F5F9" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>

            <linearGradient id="featherBackGrad" x1="100" y1="20" x2="100" y2="150" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>

            <linearGradient id="featherHighlight" x1="40" y1="20" x2="160" y2="160" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.2" />
            </linearGradient>

            {/* Gradients for Cork Base */}
            <radialGradient id="corkDome" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#F8FAFC" />
              <stop offset="70%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#94A3B8" />
            </radialGradient>

            {/* Ribbon Tape (Championship Red/Gold Stripe) */}
            <linearGradient id="corkRibbon" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#991B1B" />
              <stop offset="25%" stopColor="#DC2626" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="75%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#7F1D1D" />
            </linearGradient>

            {/* Specular Glare on Cork */}
            <linearGradient id="corkHighlight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* BACK FEATHERS LAYER (Deep shade behind) */}
          <g opacity="0.65">
            <path d="M55 45 L95 162 L105 162 L145 45 Q100 20 55 45 Z" fill="url(#featherBackGrad)" />
            <path d="M40 55 L96 162 L104 162 L160 55 Q100 25 40 55 Z" fill="url(#featherBackGrad)" opacity="0.5" />
          </g>

          {/* SPREAD OF INDIVIDUAL 3D FEATHERS */}
          {/* Feather 1 (Far Left) */}
          <path
            d="M32 75 C30 55 42 42 52 46 L95 164 L91 164 Z"
            fill="url(#featherGrad1)"
            stroke="#CBD5E1"
            strokeWidth="0.75"
          />
          {/* Feather 2 */}
          <path
            d="M45 58 C45 42 60 33 72 38 L97 165 L94 165 Z"
            fill="url(#featherGrad1)"
            stroke="#CBD5E1"
            strokeWidth="0.75"
          />
          {/* Feather 3 */}
          <path
            d="M62 45 C64 32 80 26 92 32 L99 166 L96 166 Z"
            fill="url(#featherGrad1)"
            stroke="#CBD5E1"
            strokeWidth="0.75"
          />
          {/* Feather 4 (Center Left) */}
          <path
            d="M80 37 C85 26 102 24 110 32 L101 166 L98 166 Z"
            fill="url(#featherGrad1)"
            stroke="#E2E8F0"
            strokeWidth="0.75"
          />
          {/* Feather 5 (Center Right) */}
          <path
            d="M102 34 C112 25 128 28 134 39 L103 166 L100 166 Z"
            fill="url(#featherGrad1)"
            stroke="#E2E8F0"
            strokeWidth="0.75"
          />
          {/* Feather 6 */}
          <path
            d="M122 41 C135 34 150 42 153 56 L105 165 L102 165 Z"
            fill="url(#featherGrad1)"
            stroke="#CBD5E1"
            strokeWidth="0.75"
          />
          {/* Feather 7 (Far Right) */}
          <path
            d="M142 52 C155 47 168 59 166 77 L107 164 L104 164 Z"
            fill="url(#featherGrad1)"
            stroke="#CBD5E1"
            strokeWidth="0.75"
          />

          {/* FEATHER SHAFTS (QUILLS) */}
          <g stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" opacity="0.75">
            <line x1="42" y1="60" x2="94" y2="164" />
            <line x1="58" y1="50" x2="96" y2="165" />
            <line x1="77" y1="41" x2="98" y2="166" />
            <line x1="96" y1="36" x2="100" y2="166" />
            <line x1="118" y1="38" x2="102" y2="166" />
            <line x1="138" y1="48" x2="104" y2="165" />
            <line x1="154" y1="64" x2="106" y2="164" />
          </g>

          {/* DUAL THREAD BINDINGS (Vòng chỉ buộc lông) */}
          {/* Upper thread loop */}
          <path
            d="M48 85 Q100 102 152 85"
            stroke="#475569"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
          <path
            d="M48 86 Q100 103 152 86"
            stroke="#FFFFFF"
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />

          {/* Lower thread loop */}
          <path
            d="M66 122 Q100 135 134 122"
            stroke="#475569"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
          <path
            d="M66 123 Q100 136 134 123"
            stroke="#FFFFFF"
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />

          {/* RED/GOLD RIBBON STRIPE AT THE CORK BASE */}
          <rect
            x="86"
            y="163"
            width="28"
            height="5"
            rx="2.5"
            fill="url(#corkRibbon)"
            stroke="#7F1D1D"
            strokeWidth="0.5"
          />

          {/* CORK BASE DOME (Đế cầu lông) */}
          <path
            d="M87 168 C87 168 86 198 100 206 C114 198 113 168 113 168 Z"
            fill="url(#corkDome)"
            stroke="#64748B"
            strokeWidth="0.8"
          />

          {/* Cork Gloss Highlights */}
          <path
            d="M91 170 C90 185 96 200 100 204 C97 195 94 180 94 170 Z"
            fill="url(#corkHighlight)"
            opacity="0.7"
          />

          {/* Center Light Glisten */}
          <circle cx="95" cy="182" r="3" fill="#FFFFFF" opacity="0.6" />
        </svg>
      </div>

      {/* 3D AMBIENT FLOOR SHADOW */}
      {showShadow && (
        <div
          aria-hidden="true"
          className="w-24 h-4 bg-slate-900/15 rounded-full blur-md animate-[shadowPulse_4.5s_ease-in-out_infinite] -mt-3"
        />
      )}
    </div>
  )
}
