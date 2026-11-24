import React, { useState } from 'react'
import { Card3DTilt } from './Card3DTilt'
import {
  Trophy,
  MapPin,
  Users,
  ArrowRightLeft,
  Clock,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { SessionItem, LeaderboardPage, LeaderboardEntry } from '../../types'
import { getLolRank } from '../../lib/ranks'
import { DuckMascot } from '../DuckMascot'
import { Shuttlecock3D } from './Shuttlecock3D'

export interface AthleteCard3DProps {
  name?: string
  role?: string
  tier?: string
  tierImage?: string
  elo?: number
  memberId?: string
  avatarUrl?: string
  className?: string
  ambientFloat?: boolean
  initialMode?: 'MATCH' | 'CHAMPION'
}

export const AthleteCard3D: React.FC<AthleteCard3DProps> = ({
  name: propName,
  role: _propRole,
  tier: propTier,
  tierImage: propTierImage,
  elo: propElo,
  memberId: _propMemberId = '#01',
  avatarUrl: propAvatarUrl,
  className = '',
  ambientFloat = false,
  initialMode = 'MATCH',
}) => {
  const [mode, setMode] = useState<'MATCH' | 'CHAMPION'>(initialMode)

  // 1. Fetch live upcoming session data (public permitAll)
  const { data: sessions } = useQuery<SessionItem[]>({
    queryKey: ['public-card-sessions'],
    queryFn: async () => {
      const res = await api.get('/sessions')
      return Array.isArray(res.data) ? res.data : []
    },
    staleTime: 60 * 1000,
    retry: 1,
  })

  // 2. Fetch live top leaderboard champion data (public permitAll)
  const { data: leaderboard } = useQuery<LeaderboardPage>({
    queryKey: ['public-card-champion'],
    queryFn: async () => {
      const res = await api.get('/leaderboards/wins')
      return res.data
    },
    staleTime: 60 * 1000,
    retry: 1,
  })

  // Extract next match session
  const upcomingSession = React.useMemo(() => {
    if (!sessions || sessions.length === 0) return null
    const active = sessions.find((s) => s.status === 'UPCOMING' || s.status === 'ACTIVE')
    return active || sessions[0]
  }, [sessions])

  // Extract Top 1 Champion
  const topChampion = React.useMemo<LeaderboardEntry | null>(() => {
    if (!leaderboard) return null
    if (Array.isArray(leaderboard.entries) && leaderboard.entries.length > 0) {
      return leaderboard.entries[0]
    }
    if (Array.isArray(leaderboard) && (leaderboard as any).length > 0) {
      return (leaderboard as any)[0]
    }
    return null
  }, [leaderboard])

  // Format session date & time
  const sessionTimeDisplay = React.useMemo(() => {
    if (!upcomingSession?.startTime) {
      return { time: '19:30 - 21:30', date: 'HÔM NAY' }
    }
    try {
      const start = new Date(upcomingSession.startTime)
      const end = upcomingSession.endTime ? new Date(upcomingSession.endTime) : null
      const formatTime = (d: Date) =>
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

      const timeStr = end ? `${formatTime(start)} - ${formatTime(end)}` : formatTime(start)

      const today = new Date()
      const isToday =
        start.getDate() === today.getDate() &&
        start.getMonth() === today.getMonth() &&
        start.getFullYear() === today.getFullYear()

      const dateStr = isToday
        ? 'HÔM NAY'
        : `THỨ ${start.getDay() === 0 ? 'CN' : start.getDay() + 1}, ${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`

      return { time: timeStr, date: dateStr }
    } catch {
      return { time: '19:30 - 21:30', date: 'HÔM NAY' }
    }
  }, [upcomingSession])

  // Slot calculation
  const totalSlots = upcomingSession?.maxSlots || 8
  const currentSlots = upcomingSession?.bookedSlots ?? upcomingSession?.participants?.length ?? 5
  const remainingSlots = Math.max(0, totalSlots - currentSlots)
  const slotPrice =
    upcomingSession?.memberMalePrice ||
    upcomingSession?.guestMalePrice ||
    50000

  // Champion rank calculation
  const championElo = propElo ?? topChampion?.eloScore ?? 1520
  const championRank = getLolRank(championElo)
  const championName = propName ?? topChampion?.fullName ?? 'Phạm Anh Đức'
  const championAvatar = propAvatarUrl ?? topChampion?.avatarUrl
  const championWinCount = topChampion?.winCount ?? 24
  const championWinRate = topChampion?.winRate ? Math.round(topChampion.winRate) : 75
  const championSessions = topChampion?.sessionsAttended ?? 32
  const championTier = propTier ?? championRank.tier
  const championTierImage = propTierImage ?? championRank.imagePath

  return (
    <div className={`w-full max-w-sm sm:max-w-md mx-auto space-y-3 ${className}`}>
      {/* Top Controller: Mode Tabs & Switcher */}
      <div className="flex items-center justify-between px-1">
        <div className="inline-flex p-1 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
          <button
            type="button"
            onClick={() => setMode('MATCH')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              mode === 'MATCH'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🏸</span>
            <span>Sân Ca Đấu</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-950 animate-pulse" />
          </button>

          <button
            type="button"
            onClick={() => setMode('CHAMPION')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              mode === 'CHAMPION'
                ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>👑</span>
            <span>Top 1 Elo</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMode((m) => (m === 'MATCH' ? 'CHAMPION' : 'MATCH'))}
          className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-emerald-400 transition cursor-pointer"
          title="Chuyển chế độ xem"
        >
          <ArrowRightLeft size={12} />
          <span className="hidden sm:inline">Đổi góc nhìn</span>
        </button>
      </div>

      {/* 3D Realistic Isometric Stadium Card */}
      <Card3DTilt
        maxTilt={8}
        perspective={1200}
        scale={1.01}
        ambientFloat={ambientFloat}
        className="w-full relative cursor-pointer select-none rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-slate-950"
      >
        {/* ========================================================================= */}
        {/* CARD CONTENT SHELL */}
        {/* ========================================================================= */}
        <div className="relative w-full overflow-hidden p-5 sm:p-6 flex flex-col justify-between min-h-[360px] sm:min-h-[380px]">
          {/* Overhead Stadium Spotlight & Atmosphere */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-700"
            style={{
              background:
                mode === 'MATCH'
                  ? 'radial-gradient(circle 400px at 45% 25%, rgba(16, 185, 129, 0.18), rgba(2, 44, 34, 0.4) 60%, #030712 100%)'
                  : 'radial-gradient(circle 400px at 50% 25%, rgba(245, 158, 11, 0.18), rgba(69, 39, 3, 0.4) 60%, #030712 100%)',
            }}
          />

          {/* Top Row: Club Brand & Live Session Status */}
          <div className="relative z-20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0">
                <DuckMascot size={32} rounded="xl" className="shadow-md border border-white/20" />
                <span className="absolute -top-1 -right-1 text-xs select-none">
                  {mode === 'CHAMPION' ? '👑' : '🏸'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block truncate">
                  CLB CẦU LÔNG
                </span>
                <span className="text-xs sm:text-sm font-black text-white tracking-tight block truncate">
                  Làng Địa Ngục
                </span>
              </div>
            </div>

            <div className="shrink-0">
              {mode === 'MATCH' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-bold text-emerald-300 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>MỞ ĐĂNG KÝ</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-[11px] font-bold text-amber-300 shadow-sm">
                  <Trophy size={12} className="text-amber-400" />
                  <span>TOP 1 ELO</span>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CENTER: ISOMETRIC 3D BADMINTON COURT ARENA */}
          {/* ========================================================================= */}
          <div className="relative z-10 my-auto py-2 flex items-center justify-center overflow-visible">
            {/* 3D Perspective Stage */}
            <div
              className="relative w-full max-w-[340px] flex items-center justify-center py-4"
              style={{
                perspective: '900px',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Stadium Floodlight Cone from Above */}
              <div
                className="absolute -top-12 inset-x-12 h-44 rounded-full pointer-events-none blur-2xl opacity-40 transition-colors duration-700"
                style={{
                  background:
                    mode === 'MATCH'
                      ? 'radial-gradient(ellipse at center, rgba(52, 211, 153, 0.45) 0%, transparent 70%)'
                      : 'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.45) 0%, transparent 70%)',
                }}
              />

              {/* The Tilted Court Mat Plane */}
              <div
                className="relative rounded-xl transition-all duration-700 ease-out"
                style={{
                  width: '290px',
                  height: '142px',
                  transform: 'rotateX(55deg) rotateZ(-26deg)',
                  transformStyle: 'preserve-3d',
                  background:
                    mode === 'MATCH'
                      ? 'linear-gradient(135deg, #014730 0%, #026b48 50%, #013b27 100%)'
                      : 'linear-gradient(135deg, #1b1307 0%, #2f200a 50%, #150f04 100%)',
                  boxShadow:
                    mode === 'MATCH'
                      ? '0 25px 35px -10px rgba(0, 0, 0, 0.8), 0 0 0 7px #072e21, 0 0 0 8px rgba(255, 255, 255, 0.12)'
                      : '0 25px 35px -10px rgba(0, 0, 0, 0.8), 0 0 0 7px #1c1306, 0 0 0 8px rgba(245, 158, 11, 0.2)',
                }}
              >
                {/* Court Surface Texture: PVC Mat Emboss */}
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none rounded-xl"
                  style={{
                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.45) 0.5px, transparent 0.5px)',
                    backgroundSize: '4px 4px',
                  }}
                />

                {/* Regulation BWF Court Markings (Pure White Lines) */}
                <svg
                  className="absolute inset-0 w-full h-full p-1.5 pointer-events-none"
                  viewBox="0 0 290 142"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Outer Doubles Boundary Lines */}
                  <rect
                    x="8"
                    y="6"
                    width="274"
                    height="130"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeOpacity="0.95"
                  />
                  {/* Singles Sidelines (11px inside on both sides) */}
                  <line x1="8" y1="18" x2="282" y2="18" stroke="#FFFFFF" strokeWidth="1.4" strokeOpacity="0.85" />
                  <line x1="8" y1="124" x2="282" y2="124" stroke="#FFFFFF" strokeWidth="1.4" strokeOpacity="0.85" />
                  {/* Center Net Divider Line */}
                  <line x1="145" y1="6" x2="145" y2="136" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.9" />
                  {/* Short Service Lines (40px from net) */}
                  <line x1="105" y1="6" x2="105" y2="136" stroke="#FFFFFF" strokeWidth="1.4" strokeOpacity="0.85" />
                  <line x1="185" y1="6" x2="185" y2="136" stroke="#FFFFFF" strokeWidth="1.4" strokeOpacity="0.85" />
                  {/* Doubles Back Service Lines (14px from back) */}
                  <line x1="22" y1="6" x2="22" y2="136" stroke="#FFFFFF" strokeWidth="1.3" strokeOpacity="0.85" />
                  <line x1="268" y1="6" x2="268" y2="136" stroke="#FFFFFF" strokeWidth="1.3" strokeOpacity="0.85" />
                  {/* Center Service Dividing Lines */}
                  <line x1="8" y1="71" x2="105" y2="71" stroke="#FFFFFF" strokeWidth="1.4" strokeOpacity="0.85" />
                  <line x1="185" y1="71" x2="282" y2="71" stroke="#FFFFFF" strokeWidth="1.4" strokeOpacity="0.85" />
                </svg>

                {/* Diffuse Net Shadow on Court Floor */}
                <div
                  className="absolute pointer-events-none bg-black/45 blur-[2.5px]"
                  style={{
                    left: '143px',
                    top: '4px',
                    bottom: '4px',
                    width: '12px',
                    transform: 'skewX(-16deg)',
                  }}
                />

                {/* 3D Vertical Standing Net across the Center */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: '145px',
                    top: '6px',
                    bottom: '6px',
                    width: '2px',
                    transform: 'rotateY(-90deg) translateZ(1px)',
                    transformOrigin: 'center center',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  <div
                    className="relative border-t-2 border-white shadow-sm"
                    style={{
                      width: '136px',
                      height: '22px',
                      transform: 'rotateX(-90deg) translateZ(11px) translateX(-67px)',
                      background:
                        'repeating-linear-gradient(45deg, rgba(255,255,255,0.25) 0, rgba(255,255,255,0.25) 1px, transparent 0, transparent 3px), rgba(15,23,42,0.55)',
                    }}
                  >
                    {/* White Top Cord Tape */}
                    <div className="w-full h-[2.5px] bg-white shadow-xs" />
                  </div>
                </div>

                {/* 3D Net Posts (Aluminum Steel Posts) */}
                <div
                  className="absolute w-1.5 h-6 bg-gradient-to-t from-slate-600 via-slate-200 to-white rounded-t-xs shadow-md"
                  style={{
                    left: '144px',
                    top: '2px',
                    transform: 'rotateX(-90deg) translateY(-11px)',
                    transformOrigin: 'bottom center',
                  }}
                />
                <div
                  className="absolute w-1.5 h-6 bg-gradient-to-t from-slate-600 via-slate-200 to-white rounded-t-xs shadow-md"
                  style={{
                    left: '144px',
                    bottom: '2px',
                    transform: 'rotateX(-90deg) translateY(-11px)',
                    transformOrigin: 'bottom center',
                  }}
                />

                {/* 3D Realistic Shuttlecock Positioned on Court (Match Mode) */}
                {mode === 'MATCH' && (
                  <div
                    className="absolute pointer-events-none transition-transform duration-500"
                    style={{
                      left: '122px',
                      top: '62px',
                      transformStyle: 'preserve-3d',
                      transform: 'translateZ(16px) rotateZ(32deg) scale(0.68)',
                    }}
                  >
                    {/* Contact Soft Oval Shadow on Turf */}
                    <div className="absolute -bottom-1 -left-1.5 w-7 h-3 bg-black/65 rounded-full blur-[2px] -rotate-12" />
                    {/* Realistic 3D Shuttlecock */}
                    <div className="animate-[bounceShuttlecock_3.5s_ease-in-out_infinite]">
                      <Shuttlecock3D size={42} animated={false} showShadow={false} />
                    </div>
                  </div>
                )}

                {/* Champion Trophy Glow on Court (Champion Mode) */}
                {mode === 'CHAMPION' && (
                  <div
                    className="absolute pointer-events-none flex flex-col items-center justify-center transition-transform duration-500"
                    style={{
                      left: '115px',
                      top: '46px',
                      transformStyle: 'preserve-3d',
                      transform: 'translateZ(16px) rotateX(-20deg)',
                    }}
                  >
                    {/* Golden Base Spotlight */}
                    <div className="w-14 h-6 bg-amber-400/40 rounded-full blur-[4px] animate-pulse" />
                    <div className="absolute -top-3 flex items-center justify-center">
                      <span className="text-2xl filter drop-shadow-[0_4px_8px_rgba(245,158,11,0.6)]">
                        🏆
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BOTTOM: MODERN ATHLETIC HUD DATA DISPLAY */}
          {/* ========================================================================= */}
          <div className="relative z-20 pt-2">
            {mode === 'MATCH' ? (
              /* MATCH HUD CARD */
              <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 shadow-lg space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-black text-white tracking-wide">
                      <Clock size={13} className="text-emerald-400 shrink-0" />
                      <span>{sessionTimeDisplay.time}</span>
                      <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono rounded">
                        {sessionTimeDisplay.date}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-300 font-medium truncate">
                      <MapPin size={12} className="text-emerald-400 shrink-0" />
                      <span className="truncate">{upcomingSession?.venueName || 'Sân Viettel'}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {upcomingSession?.courtNames || '2 Sân'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Vé ca</div>
                    <div className="text-xs sm:text-sm font-black text-emerald-400 font-mono">
                      {Number(slotPrice).toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="text-slate-400 text-[10px] uppercase">Host:</span>
                    <span className="font-extrabold text-white truncate max-w-[130px]">
                      {upcomingSession?.hostName || 'Phạm Anh Đức'}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-bold text-emerald-300">
                    <Users size={11} />
                    <span>Còn {remainingSlots} / {totalSlots} slot</span>
                  </div>
                </div>
              </div>
            ) : (
              /* CHAMPION HUD CARD */
              <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-3.5 border border-amber-500/20 shadow-lg space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <DuckMascot
                        src={championAvatar || '/duck-mascot.png'}
                        size={36}
                        rounded="xl"
                        className="border-2 border-amber-400 shadow-md"
                      />
                      <span className="absolute -top-1.5 -right-1.5 text-xs select-none">👑</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-black text-white uppercase tracking-wide truncate max-w-[150px]">
                        {championName}
                      </div>
                      <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                        <span>Top 1 Elo Toàn CLB</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-2.5 border-l border-white/10 text-right">
                    {championTierImage && (
                      <img
                        src={championTierImage}
                        alt={championTier}
                        className="w-8 h-8 object-contain filter drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]"
                      />
                    )}
                    <div>
                      <div className="text-xs sm:text-sm font-black text-white font-mono leading-none">
                        {championElo}
                      </div>
                      <div className="text-[9px] font-bold text-amber-400 font-mono uppercase mt-0.5">
                        {championTier}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono">
                  <div className="text-slate-300">
                    <span className="font-extrabold text-white">{championWinCount}</span>{' '}
                    <span className="text-slate-400 text-[10px]">Trận thắng</span>
                  </div>
                  <div className="text-slate-300">
                    <span className="font-extrabold text-amber-400">{championWinRate}%</span>{' '}
                    <span className="text-slate-400 text-[10px]">Tỉ lệ thắng</span>
                  </div>
                  <div className="text-slate-300">
                    <span className="font-extrabold text-white">{championSessions}</span>{' '}
                    <span className="text-slate-400 text-[10px]">Ca đấu</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card3DTilt>
    </div>
  )
}

export default AthleteCard3D
