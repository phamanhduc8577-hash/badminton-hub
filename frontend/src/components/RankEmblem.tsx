import React from 'react'
import { RankTier } from '../lib/ranks'

interface RankEmblemProps {
  tier: RankTier
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  showLabel?: boolean
  showGlow?: boolean
  className?: string
}

const GLOW_COLORS: Record<string, string> = {
  IRON: 'rgba(100, 116, 139, 0.25)',
  BRONZE: 'rgba(180, 83, 9, 0.25)',
  SILVER: 'rgba(148, 163, 184, 0.25)',
  GOLD: 'rgba(234, 179, 8, 0.35)',
  PLATINUM: 'rgba(20, 184, 166, 0.35)',
  EMERALD: 'rgba(16, 185, 129, 0.35)',
  DIAMOND: 'rgba(56, 189, 248, 0.4)',
  MASTER: 'rgba(168, 85, 247, 0.45)',
  GRANDMASTER: 'rgba(225, 29, 72, 0.45)',
  CHALLENGER: 'rgba(245, 158, 11, 0.55)',
}

export const RankEmblem: React.FC<RankEmblemProps> = ({
  tier,
  size = 'md',
  showLabel = false,
  showGlow = false,
  className = '',
}) => {
  const glowColor = GLOW_COLORS[tier.tier] || GLOW_COLORS.IRON

  // Dimensions configuration for 3D shield emblems
  const sizeConfig = {
    sm: { box: 44, label: 'text-[9px]' },
    md: { box: 60, label: 'text-[11px]' },
    lg: { box: 92, label: 'text-xs' },
    xl: { box: 124, label: 'text-sm' },
    '2xl': { box: 156, label: 'text-base' },
  }[size]

  return (
    <div className={`inline-flex flex-col items-center justify-center select-none group ${className}`}>
      <div
        className="relative flex items-center justify-center"
        style={{ width: sizeConfig.box, height: sizeConfig.box }}
      >
        {/* Soft Glow */}
        {showGlow && (
          <div
            className="absolute inset-0 rounded-full blur-md opacity-40 group-hover:opacity-80 transition-opacity duration-300 pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
            }}
          />
        )}

        {/* Crisp Shield Emblem */}
        <img
          src={tier.imagePath}
          alt={tier.name}
          className="relative z-10 w-full h-full object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-md"
          loading="lazy"
        />
      </div>

      {showLabel && (
        <span
          className={`font-black uppercase tracking-wider px-2 py-0.5 rounded-md mt-1 ${sizeConfig.label} ${tier.bgClass} ${tier.textColor} border ${tier.borderClass} shadow-xs`}
        >
          {tier.name}
        </span>
      )}
    </div>
  )
}

