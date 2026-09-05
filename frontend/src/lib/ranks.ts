export interface RankTier {
  name: string
  tier: 'UNRANKED' | 'IRON' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'EMERALD' | 'DIAMOND' | 'MASTER' | 'GRANDMASTER' | 'CHALLENGER'
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

export const LOL_RANKS: RankTier[] = [
  {
    name: 'Sắt Đoàn',
    tier: 'IRON',
    minScore: 0,
    maxScore: 0,
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
    minScore: 1,
    maxScore: 5,
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
    minScore: 6,
    maxScore: 10,
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
    minScore: 11,
    maxScore: 20,
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
    minScore: 21,
    maxScore: 30,
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
    name: 'Kim Cương',
    tier: 'DIAMOND',
    minScore: 31,
    maxScore: 50,
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
    minScore: 51,
    maxScore: 75,
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
    minScore: 76,
    maxScore: 149,
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
    minScore: 150,
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

export const getLolRank = (score: number): RankTier => {
  if (score <= 0) return LOL_RANKS[0]
  if (score >= 150) return LOL_RANKS[LOL_RANKS.length - 1]
  const found = LOL_RANKS.find((r) => score >= r.minScore && score <= r.maxScore)
  return found || LOL_RANKS[0]
}
