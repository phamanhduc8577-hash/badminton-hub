export interface RankTier {
  name: string
  tier:
    | 'UNRANKED'
    | 'IRON'
    | 'BRONZE'
    | 'SILVER'
    | 'GOLD'
    | 'PLATINUM'
    | 'EMERALD'
    | 'DIAMOND'
    | 'MASTER'
    | 'GRANDMASTER'
    | 'CHALLENGER'
  division?: 'I' | 'II' | 'III'
  minScore: number
  maxScore: number
  badge: string
  colorClass: string
  borderClass: string
  bgClass: string
  gradient: string
  textColor: string
  icon: string
  imagePath: string
}

export interface PlayerRankDisplay {
  name: string
  tier: string
  division: string
  currentLpInDivision: number
  totalLp: number
  isPlacement: boolean
  placementMatches: number
  shieldMatches: number
  badge: string
  colorClass: string
  borderClass: string
  bgClass: string
  gradient: string
  textColor: string
  icon: string
  imagePath: string
}

export const LOL_RANKS: RankTier[] = [
  {
    name: 'Sắt Đoàn',
    tier: 'IRON',
    minScore: 0,
    maxScore: 299,
    badge: 'Sắt',
    colorClass: 'text-slate-400',
    borderClass: 'border-slate-500/60',
    bgClass: 'bg-slate-100',
    gradient: 'from-slate-600 to-slate-800',
    textColor: 'text-slate-700',
    icon: '🛡️',
    imagePath: '/ranks/iron.png',
  },
  {
    name: 'Đồng Đoàn',
    tier: 'BRONZE',
    minScore: 300,
    maxScore: 599,
    badge: 'Đồng',
    colorClass: 'text-amber-700',
    borderClass: 'border-amber-800/60',
    bgClass: 'bg-amber-50',
    gradient: 'from-amber-700 to-yellow-900',
    textColor: 'text-amber-900',
    icon: '🥉',
    imagePath: '/ranks/bronze.png',
  },
  {
    name: 'Bạc Đoàn',
    tier: 'SILVER',
    minScore: 600,
    maxScore: 899,
    badge: 'Bạc',
    colorClass: 'text-slate-600',
    borderClass: 'border-slate-400',
    bgClass: 'bg-slate-50',
    gradient: 'from-slate-300 to-slate-500',
    textColor: 'text-slate-800',
    icon: '🥈',
    imagePath: '/ranks/silver.png',
  },
  {
    name: 'Vàng Đoàn',
    tier: 'GOLD',
    minScore: 900,
    maxScore: 1199,
    badge: 'Vàng',
    colorClass: 'text-yellow-600',
    borderClass: 'border-yellow-500',
    bgClass: 'bg-yellow-50',
    gradient: 'from-yellow-400 to-amber-600',
    textColor: 'text-yellow-950 font-bold',
    icon: '🥇',
    imagePath: '/ranks/gold.png',
  },
  {
    name: 'Bạch Kim',
    tier: 'PLATINUM',
    minScore: 1200,
    maxScore: 1499,
    badge: 'Bạch Kim',
    colorClass: 'text-teal-600',
    borderClass: 'border-teal-400',
    bgClass: 'bg-teal-50',
    gradient: 'from-teal-400 to-emerald-600',
    textColor: 'text-teal-950 font-bold',
    icon: '💎',
    imagePath: '/ranks/platinum.png',
  },
  {
    name: 'Lục Bảo',
    tier: 'EMERALD',
    minScore: 1500,
    maxScore: 1799,
    badge: 'Lục Bảo',
    colorClass: 'text-emerald-600',
    borderClass: 'border-emerald-400',
    bgClass: 'bg-emerald-50',
    gradient: 'from-emerald-500 to-teal-700',
    textColor: 'text-emerald-950 font-bold',
    icon: '❇️',
    imagePath: '/ranks/platinum.png',
  },
  {
    name: 'Kim Cương',
    tier: 'DIAMOND',
    minScore: 1800,
    maxScore: 2099,
    badge: 'Kim Cương',
    colorClass: 'text-cyan-600',
    borderClass: 'border-cyan-400',
    bgClass: 'bg-cyan-50',
    gradient: 'from-cyan-400 to-indigo-600',
    textColor: 'text-cyan-950 font-bold',
    icon: '🔷',
    imagePath: '/ranks/diamond.png',
  },
  {
    name: 'Cao Thủ',
    tier: 'MASTER',
    minScore: 2100,
    maxScore: 2499,
    badge: 'Cao Thủ',
    colorClass: 'text-purple-600',
    borderClass: 'border-purple-400',
    bgClass: 'bg-purple-50',
    gradient: 'from-purple-500 to-fuchsia-700',
    textColor: 'text-purple-950 font-bold',
    icon: '🔮',
    imagePath: '/ranks/master.png',
  },
  {
    name: 'Đại Cao Thủ',
    tier: 'GRANDMASTER',
    minScore: 2500,
    maxScore: 2999,
    badge: 'Đại Cao Thủ',
    colorClass: 'text-rose-600',
    borderClass: 'border-rose-400',
    bgClass: 'bg-rose-50',
    gradient: 'from-rose-500 to-red-700',
    textColor: 'text-rose-950 font-black',
    icon: '🔥',
    imagePath: '/ranks/grandmaster.png',
  },
  {
    name: 'Thách Đấu',
    tier: 'CHALLENGER',
    minScore: 3000,
    maxScore: 99999,
    badge: 'Thách Đấu',
    colorClass: 'text-amber-500',
    borderClass: 'border-amber-400 shadow-xl shadow-amber-500/30',
    bgClass: 'bg-gradient-to-r from-amber-50 via-yellow-50 to-rose-50',
    gradient: 'from-amber-400 via-rose-500 to-yellow-300',
    textColor: 'text-amber-950 font-black',
    icon: '👑',
    imagePath: '/ranks/challenger.png',
  },
]

/**
 * Calculates Division (III, II, I) and LP in division (0..99 LP)
 * With 5 placement matches support (Unranked 0/5..5/5)
 */
export const getPlayerRankDisplay = (
  score: number = 0,
  placementMatches: number = 5,
  shieldMatches: number = 0
): PlayerRankDisplay => {
  const safeScore = Math.max(0, score)
  const isPlacement = placementMatches < 5
  const safeShield = Math.max(0, shieldMatches || 0)

  // Tier calculation
  let baseTier = LOL_RANKS.find((r) => safeScore >= r.minScore && safeScore <= r.maxScore) || LOL_RANKS[0]

  if (isPlacement) {
    return {
      name: `Phân Hạng (${placementMatches}/5)`,
      tier: 'UNRANKED',
      division: `${placementMatches}/5 Trận`,
      currentLpInDivision: safeScore,
      totalLp: safeScore,
      isPlacement: true,
      placementMatches,
      shieldMatches: 0,
      badge: `Phân Hạng (${placementMatches}/5)`,
      colorClass: 'text-slate-500',
      borderClass: 'border-dashed border-slate-300',
      bgClass: 'bg-slate-100/80',
      gradient: 'from-slate-400 to-slate-600',
      textColor: 'text-slate-700',
      icon: '⏳',
      imagePath: '/ranks/iron.png',
    }
  }

  // Apex Tiers: Master, Grandmaster, Challenger don't have Divisions
  if (baseTier.tier === 'MASTER' || baseTier.tier === 'GRANDMASTER' || baseTier.tier === 'CHALLENGER') {
    const apexLp = safeScore - baseTier.minScore
    return {
      name: baseTier.name,
      tier: baseTier.tier,
      division: '',
      currentLpInDivision: apexLp,
      totalLp: safeScore,
      isPlacement: false,
      placementMatches,
      shieldMatches: safeShield,
      badge: baseTier.badge,
      colorClass: baseTier.colorClass,
      borderClass: baseTier.borderClass,
      bgClass: baseTier.bgClass,
      gradient: baseTier.gradient,
      textColor: baseTier.textColor,
      icon: baseTier.icon,
      imagePath: baseTier.imagePath,
    }
  }

  // Standard Tiers: Division III (0-99 LP), Division II (100-199 LP), Division I (200-299 LP)
  const tierOffset = safeScore - baseTier.minScore
  const divIndex = Math.floor(tierOffset / 100) // 0: III, 1: II, 2: I
  const divisionName = divIndex === 0 ? 'III' : divIndex === 1 ? 'II' : 'I'
  const currentLpInDiv = tierOffset % 100

  return {
    name: `${baseTier.name} ${divisionName}`,
    tier: baseTier.tier,
    division: divisionName,
    currentLpInDivision: currentLpInDiv,
    totalLp: safeScore,
    isPlacement: false,
    placementMatches,
    shieldMatches: safeShield,
    badge: `${baseTier.badge} ${divisionName}`,
    colorClass: baseTier.colorClass,
    borderClass: baseTier.borderClass,
    bgClass: baseTier.bgClass,
    gradient: baseTier.gradient,
    textColor: baseTier.textColor,
    icon: baseTier.icon,
    imagePath: baseTier.imagePath,
  }
}

export const getLolRank = (score: number = 0): RankTier => {
  if (score <= 0) return LOL_RANKS[0]
  if (score >= 3000) return LOL_RANKS[LOL_RANKS.length - 1]
  const found = LOL_RANKS.find((r) => score >= r.minScore && score <= r.maxScore)
  return found || LOL_RANKS[0]
}
