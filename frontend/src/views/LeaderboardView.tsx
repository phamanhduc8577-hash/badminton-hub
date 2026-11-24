import React, { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { LeaderboardEntry, LeaderboardPage } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
import { RankEmblem } from '../components/RankEmblem'
import { getLolRank, getPlayerRankDisplay } from '../lib/ranks'

const PAGE_SIZE = 30

export const LeaderboardView: React.FC = () => {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'attendance' | 'wins'>('attendance')

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
    <div className="saas-card rounded-3xl p-5 sm:p-8 space-y-6 border border-slate-300 shadow-xl shadow-slate-900/[0.04]">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            CLB CẦU LÔNG LÀNG ĐỊA NGỤC
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mt-0.5">
            Bảng xếp hạng
          </h1>
        </div>

        {/* Tab Switcher & Total Count */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div role="tablist" aria-label="Loại bảng xếp hạng" className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold w-full sm:w-auto sm:min-w-[240px] shrink-0">
            <button
              role="tab"
              aria-selected={tab === 'attendance'}
              onClick={() => setTab('attendance')}
              className={`min-h-9 py-2 px-3.5 rounded-lg transition cursor-pointer whitespace-nowrap text-center ${
                tab === 'attendance'
                  ? 'bg-white text-slate-950 shadow-xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              Chuyên cần
            </button>

            <button
              role="tab"
              aria-selected={tab === 'wins'}
              onClick={() => setTab('wins')}
              className={`min-h-9 py-2 px-3.5 rounded-lg transition cursor-pointer whitespace-nowrap text-center ${
                tab === 'wins'
                  ? 'bg-white text-slate-950 shadow-xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              Thành tích
            </button>
          </div>

          {total > 0 && (
            <span className="hidden sm:inline-flex text-xs text-slate-500 font-bold bg-slate-100 px-3 py-2 rounded-xl border border-slate-200/80 shrink-0">
              {total} thành viên
            </span>
          )}
        </div>
      </div>

      {/* Leaderboard Table / Feed */}
      <div>
        {isLoading ? (
          <div className="text-center py-20 text-slate-600 text-sm animate-pulse space-y-3">
            <DuckMascot size={48} rounded="xl" className="mx-auto" />
            <p className="font-bold text-slate-950">Đang tải dữ liệu xếp hạng...</p>
          </div>
        ) : isError && entries.length === 0 ? (
          <div role="alert" className="text-center py-14 px-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-3 max-w-md mx-auto my-6">
            <p className="text-sm font-medium text-slate-600">Không thể tải bảng xếp hạng. Vui lòng thử lại.</p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="min-h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
            >
              {isRefetching ? 'Đang tải lại...' : 'Tải lại'}
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
