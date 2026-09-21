import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Search, X, ChevronDown, Check, UserCheck } from 'lucide-react'
import { DuckMascot } from './DuckMascot'
import { Participant } from '../types'
import { getPlayerRankDisplay } from '../lib/ranks'

interface PlayerSelectProps {
  value: string
  onChange: (val: string) => void
  options: Participant[]
  playerStatsMap: Record<string, { totalSets: number; wins: number; losses: number }>
  placeholder?: string
  colorTheme?: 'blue' | 'rose'
  allowClear?: boolean
}

// Remove Vietnamese accents for fast fuzzy search
const removeVietnameseTones = (str: string) => {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export const PlayerSelect: React.FC<PlayerSelectProps> = ({
  value,
  onChange,
  options,
  playerStatsMap,
  placeholder = 'Chọn tay vợt...',
  colorTheme = 'blue',
  allowClear = true,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Find currently selected player
  const selectedPlayer = useMemo(() => {
    if (!value) return null
    return options.find((p) => String(p.userId || p.id) === String(value))
  }, [value, options])

  // Focus input on dropdown open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      setSearchTerm('')
    }
  }, [isOpen])

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter options based on search query (Name or Phone or Rank)
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options
    const query = removeVietnameseTones(searchTerm.trim())
    return options.filter((p) => {
      const nameMatch = removeVietnameseTones(p.name || '').includes(query)
      const phoneMatch = (p.phone || '').includes(query)
      const rank = getPlayerRankDisplay(p.eloScore || 0, p.placementMatches ?? 5)
      const rankMatch = removeVietnameseTones(rank.name).includes(query)
      return nameMatch || phoneMatch || rankMatch
    })
  }, [options, searchTerm])

  const themeBorderFocus = colorTheme === 'blue' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-rose-500 ring-2 ring-rose-100'
  const themeHover = colorTheme === 'blue' ? 'hover:border-blue-300' : 'hover:border-rose-300'

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Selected Box Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-white border border-slate-200 rounded-xl p-2 sm:p-2.5 flex items-center justify-between gap-2 cursor-pointer shadow-xs transition select-none ${themeHover} ${
          isOpen ? themeBorderFocus : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedPlayer ? (
            <>
              <DuckMascot
                src={selectedPlayer.avatarUrl || '/duck-mascot.png'}
                size={24}
                rounded="xl"
                className="shrink-0 border border-slate-200"
              />
              <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-900 text-xs truncate">
                  {selectedPlayer.name}
                </span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-bold shrink-0 ${
                    selectedPlayer.gender === 'FEMALE'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {selectedPlayer.gender === 'FEMALE' ? 'Nữ' : 'Nam'}
                </span>
                {(() => {
                  const rank = getPlayerRankDisplay(selectedPlayer.eloScore || 0, selectedPlayer.placementMatches ?? 5)
                  const stats = playerStatsMap[String(selectedPlayer.userId || selectedPlayer.id)]
                  return (
                    <span className="text-[10px] text-slate-500 font-semibold shrink-0">
                      • {rank.name} | 🏸 {stats?.totalSets || 0} set
                    </span>
                  )
                })()}
              </div>
            </>
          ) : (
            <span className="text-xs text-slate-400 font-medium truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {allowClear && selectedPlayer && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition"
              title="Xóa lựa chọn"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown Menu with Fast Search Input */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Gõ tên hoặc số ĐT để tìm nhanh..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* List Options */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 p-1">
            {allowClear && (
              <div
                onClick={() => {
                  onChange('')
                  setIsOpen(false)
                }}
                className={`p-2 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center justify-between ${
                  !value ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span>{placeholder.includes('Đánh đơn') ? '(Không có - Đánh đơn)' : '(Bỏ chọn)'}</span>
                {!value && <Check size={14} className="text-slate-900" />}
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                Không tìm thấy tay vợt phù hợp với "{searchTerm}"
              </div>
            ) : (
              filteredOptions.map((u) => {
                const uId = String(u.userId || u.id)
                const isSelected = String(value) === uId
                const rank = getPlayerRankDisplay(u.eloScore || 0, u.placementMatches ?? 5)
                const stats = playerStatsMap[uId] || { totalSets: 0, wins: 0, losses: 0 }

                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      onChange(uId)
                      setIsOpen(false)
                    }}
                    className={`p-2 rounded-xl text-xs cursor-pointer transition flex items-center justify-between gap-2 ${
                      isSelected
                        ? colorTheme === 'blue'
                          ? 'bg-blue-50 text-blue-950 font-bold'
                          : 'bg-rose-50 text-rose-950 font-bold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <DuckMascot
                        src={u.avatarUrl || '/duck-mascot.png'}
                        size={28}
                        rounded="xl"
                        className="shrink-0 border border-slate-200"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 truncate">{u.name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                              u.gender === 'FEMALE'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {u.gender === 'FEMALE' ? 'Nữ' : 'Nam'}
                          </span>
                          {u.isGuest && (
                            <span className="text-[9px] px-1 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded font-bold shrink-0">
                              Vãng lai
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          <span className={rank.textColor}>{rank.name} ({u.eloScore || 0} LP)</span>
                          <span>•</span>
                          <span className="font-extrabold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded">
                            🏸 {stats.totalSets} set ({stats.wins}W - {stats.losses}L)
                          </span>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check
                        size={15}
                        className={`shrink-0 ${colorTheme === 'blue' ? 'text-blue-600' : 'text-rose-600'}`}
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
