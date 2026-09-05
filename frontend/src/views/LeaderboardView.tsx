import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { LeaderboardEntry } from '../types'
import { DuckMascot } from '../components/DuckMascot'
import { RankEmblem } from '../components/RankEmblem'
import { getLolRank, LOL_RANKS } from '../lib/ranks'
import { Trophy, Flame, Award, TrendingUp, Shield, Sparkles, ChevronRight, Info, Zap } from 'lucide-react'

export const LeaderboardView: React.FC = () => {
  const [tab, setTab] = useState<'attendance' | 'wins'>('attendance')
  const [showTierSystem, setShowTierSystem] = useState<boolean>(false)

  const { data: attendanceRank, isLoading: loadingAttendance } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard-attendance'],
    queryFn: async () => {
      const res = await api.get('/leaderboards/attendance')
      return res.data
    },
  })

  const { data: winsRank, isLoading: loadingWins } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard-wins'],
    queryFn: async () => {
      const res = await api.get('/leaderboards/wins')
      return res.data
    },
  })

  const currentList = tab === 'attendance' ? attendanceRank : winsRank
  const isLoading = tab === 'attendance' ? loadingAttendance : loadingWins

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 text-slate-950 flex items-center justify-center font-black text-base shadow-lg shadow-amber-400/40 border-2 border-yellow-200 ring-2 ring-amber-400/20 shrink-0">
          👑
        </div>
      )
    }
    if (rank === 2) {
      return (
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-300 via-slate-100 to-slate-400 text-slate-900 flex items-center justify-center font-black text-base shadow-md border-2 border-slate-200 shrink-0">
          🥈
        </div>
      )
    }
    if (rank === 3) {
      return (
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-700 via-amber-600 to-yellow-800 text-white flex items-center justify-center font-black text-base shadow-md border-2 border-amber-500 shrink-0">
          🥉
        </div>
      )
    }
    return (
      <div className="w-10 text-center font-black text-slate-400 text-sm shrink-0">#{rank}</div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Top Hall of Fame Banner with LOL Emblem Showcase */}
      <div className="saas-card rounded-3xl p-8 sm:p-10 relative overflow-hidden border border-slate-300 shadow-2xl shadow-slate-900/[0.06]">
        {/* Decorative background ambient lighting */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/[0.08] via-rose-500/[0.05] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950 text-white text-xs font-bold shadow-md">
              <Trophy size={14} className="text-amber-400" />
              <span>Hệ Thống Phân Hạng Elo LMHT • CLB Làng Địa Ngục</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight">
              Bảng xếp hạng & Bậc Rank
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              Vinh danh các tay vợt theo hệ thống 10 Bậc Rank Liên Minh Huyền Thoại chuẩn Riot: Từ Đồng, Bạc, Vàng, Bạch Kim đến Cao Thủ & Thách Đấu dựa trên <b>Điểm Elo Chiến Thần (Trận Thắng - Trận Thua)</b>.
            </p>

            {/* Quick Rank Crest Strip Preview */}
            <div className="flex items-center gap-2.5 pt-2 overflow-x-auto pb-1">
              {LOL_RANKS.map((r) => (
                <div
                  key={r.tier}
                  title={`${r.name} (${r.minScore} - ${r.maxScore > 9000 ? '+' : r.maxScore} Điểm)`}
                  className="p-2 rounded-2xl bg-slate-50 hover:bg-white hover:shadow-md border border-slate-200/80 transition duration-200 cursor-pointer shrink-0"
                >
                  <RankEmblem tier={r} size="md" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={() => setShowTierSystem(!showTierSystem)}
              className="px-4 py-3 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs rounded-2xl border border-slate-300 shadow-sm transition flex items-center gap-2 active:scale-95"
            >
              <Info size={16} className="text-rose-600" />
              <span>{showTierSystem ? 'Ẩn khung 10 Bậc Rank' : 'Khung 10 Bậc Rank'}</span>
            </button>

            {/* Tab Switcher */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-300 text-xs font-bold min-w-[290px] shadow-sm">
              <button
                onClick={() => setTab('attendance')}
                className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition ${
                  tab === 'attendance'
                    ? 'bg-slate-950 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Award size={16} />
                <span>Rank Chuyên cần</span>
              </button>

              <button
                onClick={() => setTab('wins')}
                className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition ${
                  tab === 'wins'
                    ? 'bg-slate-950 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Flame size={16} className="text-rose-500" />
                <span>Rank Chiến thần</span>
              </button>
            </div>
          </div>
        </div>

        {/* 10 LOL Tier Showcase Grid */}
        {showTierSystem && (
          <div className="mt-8 pt-6 border-t border-slate-200 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-950 uppercase tracking-wider flex items-center gap-2">
                <Shield size={16} className="text-amber-500" />
                <span>Huy Hiệu Giáp Trụ & Điểm Chuẩn 10 Bậc Rank LMHT</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-bold">
                Tự động thăng cấp sau mỗi trận đấu
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-3.5">
              {LOL_RANKS.map((tier) => (
                <div
                  key={tier.tier}
                  className={`p-4 rounded-2xl border-2 ${tier.borderClass} ${tier.bgClass} flex flex-col items-center justify-center text-center shadow-md group hover:-translate-y-1 transition duration-200`}
                >
                  <RankEmblem tier={tier} size="lg" />
                  <h4 className={`font-black text-xs mt-2 ${tier.textColor}`}>{tier.name}</h4>
                  <span className="text-[10px] font-extrabold text-slate-700 mt-1 bg-white/90 px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                    {tier.maxScore > 9000 ? `&ge; ${tier.minScore} Điểm` : `${tier.minScore} - ${tier.maxScore} Điểm`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard Table / Feed */}
      <div className="saas-card rounded-3xl p-6 sm:p-8 space-y-4 border border-slate-300 shadow-xl shadow-slate-900/[0.04]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
          <div>
            <h2 className="text-xl font-black text-slate-950 flex items-center gap-2.5">
              <TrendingUp size={22} className="text-rose-600" />
              <span>
                {tab === 'attendance'
                  ? 'Bảng xếp hạng Chuyên Cần (Số buổi đã tham gia)'
                  : 'Bảng xếp hạng Chiến Thần (Số trận thắng & Win/Loss)'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-semibold">
              Hệ thống tự động xếp hạng rank và thăng cấp sau mỗi ca đánh
            </p>
          </div>
          <span className="text-xs text-slate-700 font-bold bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200 w-fit flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Tự động cập nhật Real-Time</span>
          </span>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-600 text-sm animate-pulse space-y-3">
            <DuckMascot size={48} rounded="xl" className="mx-auto" />
            <p className="font-bold text-slate-950">Đang tải dữ liệu xếp hạng...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentList?.map((entry) => {
              // For Attendance: score is sessionsAttended. For Chiến Thần (Wins): Elo Score = Max(0, winCount - lossCount)
              const score = tab === 'attendance' ? entry.sessionsAttended : (entry.eloScore ?? Math.max(0, entry.winCount - entry.lossCount))
              const rankInfo = getLolRank(score)

              return (
                <div
                  key={entry.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-400 hover:shadow-lg transition duration-200 gap-4"
                >
                  {/* Left Player Info & 3D Helmet Crest */}
                  <div className="flex items-center gap-3.5 sm:gap-4">
                    {getRankBadge(entry.rank)}

                    {tab === 'wins' && (
                      <div className="shrink-0">
                        <RankEmblem tier={rankInfo} size="md" />
                      </div>
                    )}

                    {/* Member Avatar */}
                    <div className="shrink-0">
                      <DuckMascot
                        src={entry.avatarUrl || '/duck-mascot.png'}
                        size={42}
                        rounded="xl"
                        className="shadow-sm border border-slate-200"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-black text-base text-slate-950">{entry.fullName}</span>

                        {/* LOL Tier Pill for Wins */}
                        {tab === 'wins' ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border font-black text-[11px] shadow-xs ${rankInfo.bgClass} ${rankInfo.borderClass} ${rankInfo.textColor}`}
                          >
                            <span>{rankInfo.name}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-slate-200 font-bold text-[11px] bg-slate-100 text-slate-700">
                            🏸 Thành viên
                          </span>
                        )}

                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                            entry.gender === 'FEMALE'
                              ? 'bg-rose-50 text-rose-700 border border-rose-300'
                              : 'bg-blue-50 text-blue-700 border border-blue-300'
                          }`}
                        >
                          {entry.gender === 'FEMALE' ? 'Nữ' : 'Nam'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-semibold">{entry.phone}</span>
                    </div>
                  </div>

                  {/* Right Score Matrix */}
                  <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 flex sm:flex-col justify-between items-center sm:items-end">
                    {tab === 'attendance' ? (
                      <div>
                        <div className="flex items-baseline gap-1.5 sm:justify-end">
                          <span className="text-2xl font-black text-slate-950">{entry.sessionsAttended}</span>
                          <span className="text-xs text-slate-500 font-bold">Buổi tham gia</span>
                        </div>
                        <span className="text-[11px] text-slate-500 block font-semibold">
                          Tích lũy: <b className="text-slate-900">{entry.sessionsAttended} ca đấu</b>
                        </span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 sm:justify-end">
                          <span className="text-2xl font-black text-slate-950">{score} LP</span>
                          <span className="text-xs font-bold text-slate-500">
                            ({entry.winCount}W - {entry.lossCount}L)
                          </span>
                        </div>
                        <span className="text-xs text-slate-600 block font-bold mt-0.5">
                          Tỷ lệ thắng: <b className="text-slate-950">{entry.winRate}%</b> • <b className={rankInfo.textColor}>{rankInfo.name}</b>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
