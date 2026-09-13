export interface User {
  id: number
  phone: string
  fullName: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  role: 'HOST' | 'MEMBER' | 'GUEST'
  membershipType?: 'FIXED' | 'PENDING_FIXED' | 'CASUAL'
  avatarUrl?: string
  sessionsAttended: number
  winCount: number
  lossCount: number
  winRate: number
  eloScore?: number
  placementMatches?: number
  currentStreak?: number
  shieldMatches?: number
}

export interface MemberProfile {
  id: number
  phone: string
  fullName: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  role: 'HOST' | 'MEMBER' | 'GUEST'
  membershipType: 'FIXED' | 'PENDING_FIXED' | 'CASUAL'
  avatarUrl?: string
  sessionsAttended: number
  winCount: number
  lossCount: number
  winRate: number
  eloScore?: number
  placementMatches?: number
  currentStreak?: number
  shieldMatches?: number
  createdAt: string
}

export interface AuthResponse extends User {
  token: string
}

export interface SessionItem {
  id: number
  venueId: number
  venueName: string
  venueAddress: string
  venueLatitude: number
  venueLongitude: number
  venueRadiusMeters: number
  hostId: number
  hostName: string
  title: string
  startTime: string
  endTime: string
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  maxSlots: number
  courtCount?: number
  courtNames?: string
  bookedSlots: number
  checkedInSlots: number
  memberMalePrice: number
  memberFemalePrice: number
  guestMalePrice: number
  guestFemalePrice: number
  memberMalePrice2h?: number
  memberFemalePrice2h?: number
  guestMalePrice2h?: number
  guestFemalePrice2h?: number
  depositAmount: number
  costCourt: number
  costShuttlecock: number
  costDrinks?: number
  checkinToken?: string
  tokenExpiresAt?: string
  participants?: Participant[]
}

export interface Participant {
  id: number
  sessionId: number
  userId?: number
  isGuest: boolean
  name: string
  phone: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  checkinStatus: 'PENDING' | 'CHECKED_IN' | 'LATE' | 'ABSENT'
  checkinAt?: string
  depositStatus: 'NONE' | 'PENDING' | 'PAID' | 'FORFEITED' | 'REFUNDED'
  depositAmount: number
  baseFee: number
  durationHours?: number
  slotWindow?: string
  adjustmentAmount: number
  adjustmentReason?: string
  finalFee: number
  remainingAmount: number
  paymentStatus: 'UNPAID' | 'PAID'
  paymentMethod?: 'VIETQR' | 'CASH'
  winCount?: number
  lossCount?: number
  eloScore?: number
  placementMatches?: number
  currentStreak?: number
  shieldMatches?: number
  avatarUrl?: string
}

export interface Match {
  id: number
  sessionId: number
  teamAPlayer1Id: number
  teamAPlayer1Name: string
  teamAPlayer2Id?: number
  teamAPlayer2Name?: string
  teamBPlayer1Id: number
  teamBPlayer1Name: string
  teamBPlayer2Id?: number
  teamBPlayer2Name?: string
  winningTeam: 'A' | 'B'
  courtName?: string
  createdAt: string
}

export interface LeaderboardEntry {
  id: number
  fullName: string
  phone: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  avatarUrl?: string
  sessionsAttended: number
  winCount: number
  lossCount: number
  winRate: number
  eloScore?: number
  placementMatches?: number
  currentStreak?: number
  shieldMatches?: number
  rank: number
}

export interface LoyaltyReward {
  id: number
  milestoneSessions: number
  rewardName: string
  isClaimed: boolean
  claimedAt?: string
}

export interface AttendanceRecord {
  sessionId: number
  sessionTitle: string
  venueName: string
  checkinAt: string
}

export interface HostReport {
  sessionId: number
  title: string
  totalPlayers: number
  checkedInPlayers: number
  paidPlayers: number
  unpaidPlayers: number
  totalRevenue: number
  totalDepositCollected: number
  costCourt: number
  costShuttlecock: number
  costDrinks?: number
  totalExpenses: number
  netProfit: number
  mvpUserId?: number
  mvpName?: string
  mvpAvatarUrl?: string
  mvpWins?: number
  mvpLosses?: number
}
