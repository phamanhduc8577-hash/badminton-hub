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
    name: 'Iron',
    tier: 'IRON',
    minScore: 0,
    maxScore: 299,
    badge: 'Iron',
    colorClass: 'text-slate-400',
    borderClass: 'border-slate-400/80',
    bgClass: 'bg-slate-50',
    gradient: 'from-slate-500 to-slate-700',
    textColor: 'text-slate-800 font-bold',
    icon: '🛡️',
    imagePath: '/ranks/riot/iron.png',
  },
  {
    name: 'Bronze',
    tier: 'BRONZE',
    minScore: 300,
    maxScore: 599,
    badge: 'Bronze',
    colorClass: 'text-amber-700',
    borderClass: 'border-amber-600/70',
    bgClass: 'bg-amber-50/70',
    gradient: 'from-amber-600 to-orange-800',
    textColor: 'text-amber-950 font-bold',
    icon: '🥉',
    imagePath: '/ranks/riot/bronze.png',
  },
  {
    name: 'Silver',
    tier: 'SILVER',
    minScore: 600,
    maxScore: 899,
    badge: 'Silver',
    colorClass: 'text-slate-600',
    borderClass: 'border-slate-400',
    bgClass: 'bg-slate-50',
    gradient: 'from-slate-300 to-slate-500',
    textColor: 'text-slate-900 font-bold',
    icon: '🥈',
    imagePath: '/ranks/riot/silver.png',
  },
  {
    name: 'Gold',
    tier: 'GOLD',
    minScore: 900,
    maxScore: 1199,
    badge: 'Gold',
    colorClass: 'text-yellow-600',
    borderClass: 'border-yellow-400',
    bgClass: 'bg-yellow-50/80',
    gradient: 'from-yellow-400 to-amber-600',
    textColor: 'text-yellow-950 font-black',
    icon: '🥇',
    imagePath: '/ranks/riot/gold.png',
  },
  {
    name: 'Platinum',
    tier: 'PLATINUM',
    minScore: 1200,
    maxScore: 1499,
    badge: 'Platinum',
    colorClass: 'text-teal-600',
    borderClass: 'border-teal-400',
    bgClass: 'bg-teal-50/80',
    gradient: 'from-teal-400 to-emerald-600',
    textColor: 'text-teal-950 font-black',
    icon: '💎',
    imagePath: '/ranks/riot/platinum.png',
  },
  {
    name: 'Emerald',
    tier: 'EMERALD',
    minScore: 1500,
    maxScore: 1799,
    badge: 'Emerald',
    colorClass: 'text-emerald-600',
    borderClass: 'border-emerald-400',
    bgClass: 'bg-emerald-50/80',
    gradient: 'from-emerald-500 to-teal-700',
    textColor: 'text-emerald-950 font-black',
    icon: '❇️',
    imagePath: '/ranks/riot/emerald.png',
  },
  {
    name: 'Diamond',
    tier: 'DIAMOND',
    minScore: 1800,
    maxScore: 2099,
    badge: 'Diamond',
    colorClass: 'text-cyan-600',
    borderClass: 'border-cyan-400',
    bgClass: 'bg-cyan-50/80',
    gradient: 'from-cyan-400 to-indigo-600',
    textColor: 'text-cyan-950 font-black',
    icon: '🔷',
    imagePath: '/ranks/riot/diamond.png',
  },
  {
    name: 'Master',
    tier: 'MASTER',
    minScore: 2100,
    maxScore: 2499,
    badge: 'Master',
    colorClass: 'text-purple-600',
    borderClass: 'border-purple-400',
    bgClass: 'bg-purple-50/80',
    gradient: 'from-purple-500 to-fuchsia-700',
    textColor: 'text-purple-950 font-black',
    icon: '🔮',
    imagePath: '/ranks/riot/master.png',
  },
  {
    name: 'Grandmaster',
    tier: 'GRANDMASTER',
    minScore: 2500,
    maxScore: 2999,
    badge: 'Grandmaster',
    colorClass: 'text-rose-600',
    borderClass: 'border-rose-400',
    bgClass: 'bg-rose-50/80',
    gradient: 'from-rose-500 to-red-700',
    textColor: 'text-rose-950 font-black',
    icon: '🔥',
    imagePath: '/ranks/riot/grandmaster.png',
  },
  {
    name: 'Challenger',
    tier: 'CHALLENGER',
    minScore: 3000,
    maxScore: 99999,
    badge: 'Challenger',
    colorClass: 'text-amber-500',
    borderClass: 'border-amber-400 shadow-xl shadow-amber-400/20',
    bgClass: 'bg-gradient-to-r from-amber-50 via-yellow-50 to-rose-50',
    gradient: 'from-amber-400 via-rose-500 to-yellow-300',
    textColor: 'text-amber-950 font-black',
    icon: '👑',
    imagePath: '/ranks/riot/challenger.png',
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
      name: `Placement (${placementMatches}/5)`,
      tier: 'UNRANKED',
      division: `${placementMatches}/5 Matches`,
      currentLpInDivision: safeScore,
      totalLp: safeScore,
      isPlacement: true,
      placementMatches,
      shieldMatches: 0,
      badge: `Placement (${placementMatches}/5)`,
      colorClass: 'text-slate-500',
      borderClass: 'border-dashed border-slate-300',
      bgClass: 'bg-slate-100/80',
      gradient: 'from-slate-400 to-slate-600',
      textColor: 'text-slate-700',
      icon: '⏳',
      imagePath: '/ranks/riot/iron.png',
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
