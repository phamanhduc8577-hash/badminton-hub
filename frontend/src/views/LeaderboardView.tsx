import React, { useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { LeaderboardEntry, LeaderboardPage } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
import { RankEmblem } from '../components/RankEmblem'
import { getLolRank, getPlayerRankDisplay, LOL_RANKS } from '../lib/ranks'
import { Trophy, Flame, Award, TrendingUp, Shield, Sparkles, ChevronRight, Info, Zap } from 'lucide-react'

const PAGE_SIZE = 30

export const LeaderboardView: React.FC = () => {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'attendance' | 'wins'>('attendance')
  const [showTierSystem, setShowTierSystem] = useState<boolean>(false)
  const tierPanelRef = useRef<HTMLDivElement>(null)

  // Chạm huy hiệu rank → mở bảng 10 bậc rank và cuộn tới đó
  const openTierSystem = () => {
    setShowTierSystem(true)
    requestAnimationFrame(() => {
      tierPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    })
  }

  // Chỉ tải bảng của tab đang mở, mỗi lần 30 người; "Xem thêm" mới tải trang kế tiếp
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<LeaderboardPage>({
    queryKey: ['leaderboards', tab, user?.id ?? 'anon'],
    queryFn: async ({ pageParam }) => {
      const res = await api.get(`/leaderboards/${tab}`, {
        params: { page: pageParam, size: PAGE_SIZE },
      })
      return res.data
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  })

  const entries: LeaderboardEntry[] = data?.pages.flatMap((p) => p.entries) ?? []
  const me: LeaderboardEntry | null = data?.pages[0]?.me ?? null
  const total = data?.pages[0]?.total ?? 0
  const meIsListed = !!me && entries.some((e) => e.id === me.id)

  // Nếu người xem nằm ngoài phần đã tải, ghim hạng của họ ngay dưới danh sách để khỏi phải cuộn tìm
  const renderList: { entry: LeaderboardEntry; pinned: boolean }[] = [
    ...entries.map((entry) => ({ entry, pinned: false })),
    ...(me && !meIsListed ? [{ entry: me, pinned: true }] : []),
  ]

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
      <div className="saas-card rounded-3xl p-5 sm:p-10 relative overflow-hidden border border-slate-300 shadow-2xl shadow-slate-900/[0.06]">
        {/* Decorative background ambient lighting */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/[0.08] via-rose-500/[0.05] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950 text-white text-xs font-bold shadow-md">
              <Trophy size={14} className="text-amber-400" />
              <span>Hệ Thống Phân Hạng</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight">
              Bảng xếp hạng
            </h1>

            {/* Quick Rank Crest Strip Preview — chạm để mở bảng 10 bậc rank (thay cho tooltip chỉ có khi rê chuột) */}
            <div className="flex items-center gap-2.5 pt-2 overflow-x-auto no-scrollbar pb-1 touch-pan-x">
              {LOL_RANKS.map((r) => (
                <button
                  type="button"
                  key={r.tier}
                  onClick={openTierSystem}
                  title={`${r.name} (${r.minScore} - ${r.maxScore > 9000 ? '+' : r.maxScore} Điểm)`}
                  aria-label={`${r.name}: xem bảng 10 bậc rank`}
                  className="p-2 rounded-2xl bg-slate-50 hover:bg-white hover:shadow-md border border-slate-200/80 transition duration-200 cursor-pointer shrink-0"
                >
                  <RankEmblem tier={r} size="md" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowTierSystem(!showTierSystem)}
              aria-expanded={showTierSystem}
              aria-controls="tier-system-panel"
              className="min-h-11 px-4 py-2.5 sm:py-3 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs rounded-2xl border border-slate-300 shadow-sm transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Info size={16} className="text-rose-600" />
              <span>{showTierSystem ? 'Ẩn khung 10 Bậc Rank' : 'Khung 10 Bậc Rank'}</span>
            </button>

            {/* Tab Switcher */}
            <div role="tablist" aria-label="Loại bảng xếp hạng" className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-300 text-xs font-bold w-full sm:w-auto sm:min-w-[290px] shadow-sm">
              <button
                role="tab"
                aria-selected={tab === 'attendance'}
                onClick={() => setTab('attendance')}
                className={`min-h-11 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  tab === 'attendance'
                    ? 'bg-slate-950 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Award size={15} className="hidden sm:block" />
                <span className="sm:hidden">Chuyên cần</span>
                <span className="hidden sm:inline">Rank Chuyên cần</span>
              </button>

              <button
                role="tab"
                aria-selected={tab === 'wins'}
                onClick={() => setTab('wins')}
                className={`min-h-11 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  tab === 'wins'
                    ? 'bg-slate-950 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Flame size={15} className="hidden sm:block text-rose-500" />
                <span className="sm:hidden">Chiến thần</span>
                <span className="hidden sm:inline">Rank Chiến thần</span>
              </button>
            </div>
          </div>
        </div>

        {/* 10 Tier Showcase Grid */}
        {showTierSystem && (
          <div ref={tierPanelRef} id="tier-system-panel" className="mt-8 pt-6 border-t border-slate-200 space-y-4 animate-in fade-in duration-300 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-950 uppercase tracking-wider flex items-center gap-2">
                <Shield size={16} className="text-amber-500" />
                <span>Huy Hiệu & Điểm Chuẩn 10 Bậc Rank</span>
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
                    {tier.maxScore > 9000 ? `≥ ${tier.minScore} LP` : `${tier.minScore} - ${tier.maxScore} LP`}
                  </span>
                  <span className="text-[9px] text-slate-500 mt-0.5 font-bold">
                    {tier.tier === 'MASTER' || tier.tier === 'GRANDMASTER' || tier.tier === 'CHALLENGER' ? 'Không chia Đoàn' : '100 LP / Đoàn (III -> I)'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard Table / Feed */}
      <div className="saas-card rounded-3xl p-4 sm:p-8 space-y-4 border border-slate-300 shadow-xl shadow-slate-900/[0.04]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
          <div>
            <h2 className="text-xl font-black text-slate-950 flex items-center gap-2.5">
              <TrendingUp size={22} className="text-rose-600" />
              <span>
                {tab === 'attendance'
                  ? 'Bảng xếp hạng Chuyên Cần'
                  : 'Bảng xếp hạng Chiến Thần'}
              </span>
            </h2>
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
        ) : isError && entries.length === 0 ? (
          <div role="alert" className="text-center py-12 px-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
            <p className="text-sm font-bold text-rose-700">Không thể tải bảng xếp hạng. Vui lòng kiểm tra kết nối mạng.</p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="min-h-11 px-5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-bold transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isRefetching ? 'Đang tải lại...' : 'Thử lại'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {renderList.map(({ entry, pinned }) => {
              const isMe = me?.id === entry.id
              const score = tab === 'attendance' ? entry.sessionsAttended : (entry.eloScore ?? 0)
              const rankDisplay = getPlayerRankDisplay(entry.eloScore ?? 0, entry.placementMatches ?? 5, entry.shieldMatches ?? 0)
              const baseTier = getLolRank(entry.eloScore ?? 0)

              return (
                <React.Fragment key={`${pinned ? 'me-' : ''}${entry.id}`}>
                {pinned && (
                  <div className="flex items-center gap-3 pt-2 text-[11px] font-black text-rose-600 uppercase tracking-wider">
                    <span className="flex-1 border-t border-dashed border-rose-300" />
                    <span>Hạng của bạn</span>
                    <span className="flex-1 border-t border-dashed border-rose-300" />
                  </div>
                )}
                <div
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl border hover:border-slate-400 hover:shadow-lg transition duration-200 gap-4 ${
                    isMe ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/40' : 'border-slate-200/90 bg-white'
                  }`}
                >
                  {/* Left Player Info & 3D Helmet Crest */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    {getRankBadge(entry.rank)}

                    {tab === 'wins' && (
                      <div className="shrink-0">
                        <RankEmblem tier={baseTier} size="md" />
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

                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-black text-base text-slate-950 break-words min-w-0">{entry.fullName}</span>
                        {isMe && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-600 text-white font-black">Bạn</span>
                        )}

                        {/* LOL Tier Pill for Wins */}
                        {tab === 'wins' ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border font-black text-[11px] shadow-xs ${rankDisplay.bgClass} ${rankDisplay.borderClass} ${rankDisplay.textColor}`}
                            >
                              <span>{rankDisplay.name}</span>
                              {!rankDisplay.isPlacement && rankDisplay.division && (
                                <span className="opacity-80">({rankDisplay.currentLpInDivision} LP)</span>
                              )}
                            </span>
                            {!rankDisplay.isPlacement && (entry.shieldMatches ?? 0) > 0 && (
                              <span
                                title={`Đang được bảo vệ rank (${entry.shieldMatches} trận khiên còn lại)`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 font-extrabold text-[10px] shadow-2xs animate-pulse"
                              >
                                🛡️ {entry.shieldMatches} trận giáp
                              </span>
                            )}
                          </div>
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
                      {entry.phone && <span className="text-xs text-slate-500 font-semibold">{entry.phone}</span>}
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
                          <span className="text-2xl font-black text-slate-950">{entry.eloScore ?? 0} LP</span>
                          <span className="text-xs font-bold text-slate-500">
                            ({entry.winCount}W - {entry.lossCount}L)
                          </span>
                        </div>
                        <span className="text-xs text-slate-600 block font-bold mt-0.5">
                          Tỷ lệ thắng: <b className="text-slate-950">{entry.winRate}%</b> • <b className={rankDisplay.textColor}>{rankDisplay.name}</b>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                </React.Fragment>
              )
            })}

            {entries.length === 0 && (
              <p className="text-center py-10 text-sm font-bold text-slate-500">Chưa có dữ liệu xếp hạng.</p>
            )}

            {hasNextPage && (
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isFetchingNextPage ? 'Đang tải...' : `Xem thêm (${entries.length}/${total})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
