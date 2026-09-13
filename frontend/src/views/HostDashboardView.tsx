import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { SessionItem, Participant, Match, HostReport } from '../types'
import { QRCodeSVG } from 'qrcode.react'
import { DuckMascot } from '../components/DuckMascot'
import { useToast } from '../components/ToastProvider'
import { getPlayerRankDisplay, getLolRank } from '../lib/ranks'
import { CurrencyInput } from '../components/CurrencyInput'
import {
  Users,
  Swords,
  DollarSign,
  Edit2,
  RefreshCw,
  Maximize2,
  X,
  Shield,
  ArrowLeft,
  Receipt,
  UserCheck,
  Zap,
  Sparkles,
  Layers,
  BarChart3,
  MapPin,
  CheckCircle2,
  Plus,
  Trash2,
  Square,
  CheckSquare,
} from 'lucide-react'

interface CourtDraft {
  teamAP1: string
  teamAP2: string
  teamBP1: string
  teamBP2: string
}

export const HostDashboardView: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  // State tabs: 'roster' | 'matchmaker' | 'settle'
  const [activeTab, setActiveTab] = useState<'roster' | 'matchmaker' | 'settle'>('roster')

  // Fullscreen Dynamic QR Modal
  const [showQrModal, setShowQrModal] = useState(false)

  // Override Bill Modal State
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null)
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0)
  const [adjustmentReason, setAdjustmentReason] = useState<string>('')

  // Settle Payment Modal State (Replaces buggy window.confirm)
  const [settlingParticipant, setSettlingParticipant] = useState<Participant | null>(null)

  // Custom UI Modals (Replaces native browser window.confirm / window.prompt)
  const [confirmRemoveParticipant, setConfirmRemoveParticipant] = useState<Participant | null>(null)
  const [confirmRemoveCourt, setConfirmRemoveCourt] = useState<string | null>(null)
  const [showAddCourtModal, setShowAddCourtModal] = useState(false)
  const [newCourtNameInput, setNewCourtNameInput] = useState('')
  const [showCourtEditModal, setShowCourtEditModal] = useState(false)
  const [courtEditNamesInput, setCourtEditNamesInput] = useState('')
  const [courtEditSlotsInput, setCourtEditSlotsInput] = useState<number>(8)

  // Edit Match Modal State
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [editMatchTeamAP1, setEditMatchTeamAP1] = useState<string>('')
  const [editMatchTeamAP2, setEditMatchTeamAP2] = useState<string>('')
  const [editMatchTeamBP1, setEditMatchTeamBP1] = useState<string>('')
  const [editMatchTeamBP2, setEditMatchTeamBP2] = useState<string>('')
  const [editMatchWinningTeam, setEditMatchWinningTeam] = useState<'A' | 'B'>('A')
  const [editMatchCourtName, setEditMatchCourtName] = useState<string>('')
  const [confirmDeleteMatchId, setConfirmDeleteMatchId] = useState<number | null>(null)

  // Active Court Selected for Multi-Court Matchmaking
  const [activeCourtIndex, setActiveCourtIndex] = useState<number>(0)

  // Multi-court drafts: Court Name -> CourtDraft (Persisted in localStorage across F5)
  const [courtDrafts, setCourtDrafts] = useState<Record<string, CourtDraft>>(() => {
    try {
      const saved = localStorage.getItem(`smashflow_drafts_${id}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Auto-sync courtDrafts to localStorage
  useEffect(() => {
    if (id) {
      try {
        localStorage.setItem(`smashflow_drafts_${id}`, JSON.stringify(courtDrafts))
      } catch {}
    }
  }, [courtDrafts, id])

  const { data: session, isLoading } = useQuery<SessionItem>({
    queryKey: ['session', id],
    queryFn: async () => {
      const res = await api.get(`/sessions/${id}`)
      return res.data
    },
    refetchInterval: 3000,
  })

  const { data: matches } = useQuery<Match[]>({
    queryKey: ['matches', id],
    queryFn: async () => {
      const res = await api.get(`/matches/session/${id}`)
      return res.data
    },
    enabled: !!id,
  })

  const { data: report } = useQuery<HostReport>({
    queryKey: ['report', id],
    queryFn: async () => {
      const res = await api.get(`/reports/session/${id}`)
      return res.data
    },
    enabled: true,
  })

  // Parse court list from session
  const courtList = useMemo(() => {
    if (!session) return ['Sân 1', 'Sân 2']
    if (session.courtNames && session.courtNames.trim().length > 0) {
      const list = session.courtNames
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (list.length > 0) return list
    }
    const count = session.courtCount || 2
    return Array.from({ length: count }, (_, i) => `Sân ${i + 1}`)
  }, [session])

  const currentCourtName = courtList[activeCourtIndex] || courtList[0] || 'Sân 1'

  // Checkin Direct URL for QR code (Scannable via Camera or Zalo)
  const checkinDirectUrl = useMemo(() => {
    if (!session?.id || !session?.checkinToken) return ''
    return `${window.location.origin}/sessions/${session.id}?token=${session.checkinToken}`
  }, [session?.id, session?.checkinToken])

  // Current draft for the selected court
  const currentDraft = useMemo<CourtDraft>(() => {
    return (
      courtDrafts[currentCourtName] || {
        teamAP1: '',
        teamAP2: '',
        teamBP1: '',
        teamBP2: '',
      }
    )
  }, [courtDrafts, currentCourtName])

  const updateCurrentDraft = (field: keyof CourtDraft, value: string) => {
    setCourtDrafts((prev) => ({
      ...prev,
      [currentCourtName]: {
        ...(prev[currentCourtName] || {
          teamAP1: '',
          teamAP2: '',
          teamBP1: '',
          teamBP2: '',
        }),
        [field]: value,
      },
    }))
  }

  // Calculate stats for Fair-Play Sets Distribution in this session (with audit logs of courts)
  const playerStatsMap = useMemo(() => {
    const stats: Record<
      string,
      {
        totalSets: number
        wins: number
        losses: number
        lastCourt?: string
        courtHistory: string[]
      }
    > = {}

    if (!session?.participants) return stats

    // Initialize all roster players with 0 sets
    session.participants.forEach((p) => {
      const uid = String(p.userId || p.id)
      stats[uid] = { totalSets: 0, wins: 0, losses: 0, courtHistory: [] }
    })

    if (!matches) return stats

    matches.forEach((m) => {
      const pA1 = String(m.teamAPlayer1Id)
      const pA2 = m.teamAPlayer2Id ? String(m.teamAPlayer2Id) : null
      const pB1 = String(m.teamBPlayer1Id)
      const pB2 = m.teamBPlayer2Id ? String(m.teamBPlayer2Id) : null

      const teamAWon = m.winningTeam === 'A'
      const courtUsed = m.courtName || 'Sân 1'

      const recordPlayer = (id: string, isWinner: boolean) => {
        if (!stats[id]) {
          stats[id] = { totalSets: 0, wins: 0, losses: 0, courtHistory: [] }
        }
        stats[id].totalSets += 1
        stats[id].courtHistory.push(courtUsed)
        stats[id].lastCourt = courtUsed

        if (isWinner) {
          stats[id].wins += 1
        } else {
          stats[id].losses += 1
        }
      }

      recordPlayer(pA1, teamAWon)
      if (pA2) recordPlayer(pA2, teamAWon)
      recordPlayer(pB1, !teamAWon)
      if (pB2) recordPlayer(pB2, !teamAWon)
    })

    return stats
  }, [session, matches])

  // Roster table sorting: Người chưa thanh toán (UNPAID) lên đầu, người đã thanh toán (PAID) đảo xuống cuối
  const sortedParticipants = useMemo(() => {
    if (!session?.participants) return []
    return [...session.participants].sort((a, b) => {
      const aPaid = a.paymentStatus === 'PAID'
      const bPaid = b.paymentStatus === 'PAID'
      if (aPaid !== bPaid) {
        return aPaid ? 1 : -1
      }
      return a.id - b.id
    })
  }, [session?.participants])

  // Fixed minimum target sets per player (Standard 6 sets per player for a regular badminton session)
  const minTargetSets = 6

  // Manual Checkin Mutation
  const manualCheckinMutation = useMutation({
    mutationFn: async (participantId: number) => {
      const res = await api.post(`/sessions/participants/${participantId}/manual-checkin`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] })
    },
  })

  // Confirm Deposit Mutation
  const confirmDepositMutation = useMutation({
    mutationFn: async (participantId: number) => {
      const res = await api.post(`/sessions/participants/${participantId}/confirm-deposit`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] })
    },
  })

  // Override Bill Mutation
  const overrideBillMutation = useMutation({
    mutationFn: async () => {
      if (!selectedParticipant) return
      const res = await api.post('/sessions/participants/override-bill', {
        participantId: selectedParticipant.id,
        adjustmentAmount,
        adjustmentReason,
      })
      return res.data
    },
    onSuccess: () => {
      setSelectedParticipant(null)
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['report', id] })
    },
  })

  // Settle Payment Mutation
  const settlePaymentMutation = useMutation({
    mutationFn: async ({ participantId, method }: { participantId: number; method: 'CASH' | 'VIETQR' }) => {
      const res = await api.post('/sessions/participants/settle', {
        participantId,
        paymentMethod: method,
      })
      return res.data
    },
    onSuccess: (_, vars) => {
      setSettlingParticipant(null)
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      showToast(
        vars.method === 'CASH'
          ? 'Đã xác nhận thu tiền mặt thành công!'
          : 'Đã xác nhận thu tiền qua VietQR thành công!',
        'success'
      )
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể cập nhật quyết toán!', 'error')
    },
  })

  // Dynamic Courts Mutation (Add, Edit, Delete Courts, Update Slots)
  const updateCourtsMutation = useMutation({
    mutationFn: async ({ newCourtNames, newMaxSlots }: { newCourtNames: string; newMaxSlots?: number }) => {
      const res = await api.put(`/sessions/${id}/courts`, {
        courtNames: newCourtNames,
        maxSlots: newMaxSlots,
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể cập nhật danh sách sân!', 'error')
    },
  })

  // Remove / Cancel Participant Mutation
  const removeParticipantMutation = useMutation({
    mutationFn: async ({ participantId, forfeitDeposit }: { participantId: number; forfeitDeposit: boolean }) => {
      const res = await api.delete(`/sessions/participants/${participantId}?forfeitDeposit=${forfeitDeposit}`)
      return res.data
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      showToast(data.message || 'Đã xử lý thành công!')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể xóa người tham gia!', 'error')
    },
  })

  // Auto-seed Full Simulation Mutation (8 players, GPS check-ins, 6 balanced matches)
  const autoSeedMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/sessions/${id}/auto-seed-matches`)
      return res.data
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['matches', id] })
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      showToast(data.message || 'Mô phỏng 8 người & 6 trận đấu thành công!')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể chạy mô phỏng!', 'error')
    },
  })

  const handleAddCourt = (customName?: string) => {
    let newCourt = (customName || newCourtNameInput).trim()
    if (!newCourt) {
      // Find smallest unused number: Sân 1, Sân 2, ...
      const existingNums = courtList
        .map((c) => {
          const m = c.match(/(\d+)/)
          return m ? parseInt(m[1], 10) : 0
        })
        .filter((n) => n > 0)
      let nextNum = 1
      while (existingNums.includes(nextNum)) {
        nextNum++
      }
      newCourt = `Sân ${nextNum}`
    }

    if (courtList.some((c) => c.toLowerCase() === newCourt.toLowerCase())) {
      showToast(`Tên [${newCourt}] đã tồn tại trong ca!`, 'error')
      return
    }

    const newCourtCount = courtList.length + 1
    const newMaxSlots = newCourtCount * 8
    const updatedList = [...courtList, newCourt].join(', ')
    setShowAddCourtModal(false)
    setNewCourtNameInput('')
    updateCourtsMutation.mutate({ newCourtNames: updatedList, newMaxSlots })
    showToast(`Đã mở thêm [${newCourt}] & cập nhật quân số tối đa thành ${newMaxSlots} người!`, 'success')
  }

  const handleRemoveCourt = (courtToRemove: string) => {
    if (courtList.length <= 1) {
      showToast('Phải giữ lại tối thiểu 1 sân để tổ chức ca đánh!', 'error')
      return
    }
    setConfirmRemoveCourt(courtToRemove)
  }

  const handleRemoveParticipant = (p: Participant) => {
    if (p.checkinStatus === 'CHECKED_IN') {
      showToast('Người chơi này đã tới sân và điểm danh thành công, không thể xóa khỏi ca!', 'error')
      return
    }
    setConfirmRemoveParticipant(p)
  }

  // Record Match Result Mutation
  const recordMatchMutation = useMutation({
    mutationFn: async ({ winningTeam, court }: { winningTeam: 'A' | 'B'; court: string }) => {
      const draft = courtDrafts[court] || currentDraft
      const res = await api.post('/matches', {
        sessionId: Number(id),
        teamAPlayer1Id: Number(draft.teamAP1),
        teamAPlayer2Id: draft.teamAP2 ? Number(draft.teamAP2) : null,
        teamBPlayer1Id: Number(draft.teamBP1),
        teamBPlayer2Id: draft.teamBP2 ? Number(draft.teamBP2) : null,
        winningTeam,
        courtName: court,
      })
      return res.data
    },
    onSuccess: (_, vars) => {
      // Clear the draft for this court
      setCourtDrafts((prev) => ({
        ...prev,
        [vars.court]: {
          teamAP1: '',
          teamAP2: '',
          teamBP1: '',
          teamBP2: '',
        },
      }))
      queryClient.invalidateQueries({ queryKey: ['matches', id] })
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      showToast(`Đã ghi nhận kết quả trận đấu cho [${vars.court}] thành công!`)
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể ghi nhận trận đấu!', 'error')
    },
  })

  // Update Match Mutation (Edit Players / Switch Winner)
  const updateMatchMutation = useMutation({
    mutationFn: async ({
      matchId,
      teamAPlayer1Id,
      teamAPlayer2Id,
      teamBPlayer1Id,
      teamBPlayer2Id,
      winningTeam,
      courtName,
    }: {
      matchId: number
      teamAPlayer1Id: number
      teamAPlayer2Id: number | null
      teamBPlayer1Id: number
      teamBPlayer2Id: number | null
      winningTeam: 'A' | 'B'
      courtName: string
    }) => {
      const res = await api.put(`/matches/${matchId}`, {
        teamAPlayer1Id,
        teamAPlayer2Id,
        teamBPlayer1Id,
        teamBPlayer2Id,
        winningTeam,
        courtName,
      })
      return res.data
    },
    onSuccess: () => {
      setEditingMatch(null)
      queryClient.invalidateQueries({ queryKey: ['matches', id] })
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      showToast('Đã cập nhật kết quả và đồng bộ lại Elo / Win-Lose thành công!', 'success')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể cập nhật trận đấu!', 'error')
    },
  })

  // Delete Match Mutation (Undo / Hoàn tác trận đấu)
  const deleteMatchMutation = useMutation({
    mutationFn: async (matchId: number) => {
      const res = await api.delete(`/matches/${matchId}`)
      return res.data
    },
    onSuccess: () => {
      setConfirmDeleteMatchId(null)
      setEditingMatch(null)
      queryClient.invalidateQueries({ queryKey: ['matches', id] })
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      showToast('Đã xóa trận đấu và hoàn tác toàn bộ số set / điểm rank thành công!', 'success')
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Không thể xóa trận đấu!', 'error')
    },
  })

  const openEditMatchModal = (m: Match) => {
    setEditingMatch(m)
    setEditMatchTeamAP1(String(m.teamAPlayer1Id))
    setEditMatchTeamAP2(m.teamAPlayer2Id ? String(m.teamAPlayer2Id) : '')
    setEditMatchTeamBP1(String(m.teamBPlayer1Id))
    setEditMatchTeamBP2(m.teamBPlayer2Id ? String(m.teamBPlayer2Id) : '')
    setEditMatchWinningTeam(m.winningTeam)
    setEditMatchCourtName(m.courtName || currentCourtName)
  }

  const handleSaveEditedMatch = () => {
    if (!editingMatch) return
    if (!editMatchTeamAP1 || !editMatchTeamBP1) {
      showToast('Vui lòng chọn tối thiểu 1 người chơi cho mỗi đội!', 'error')
      return
    }
    const selected = [editMatchTeamAP1, editMatchTeamAP2, editMatchTeamBP1, editMatchTeamBP2].filter(Boolean)
    const unique = new Set(selected)
    if (unique.size !== selected.length) {
      showToast('Một người chơi không thể cùng lúc ở 2 vị trí!', 'error')
      return
    }
    updateMatchMutation.mutate({
      matchId: editingMatch.id,
      teamAPlayer1Id: Number(editMatchTeamAP1),
      teamAPlayer2Id: editMatchTeamAP2 ? Number(editMatchTeamAP2) : null,
      teamBPlayer1Id: Number(editMatchTeamBP1),
      teamBPlayer2Id: editMatchTeamBP2 ? Number(editMatchTeamBP2) : null,
      winningTeam: editMatchWinningTeam,
      courtName: editMatchCourtName || editingMatch.courtName || 'Sân 1',
    })
  }

  const rosterUsers = session?.participants || []

  // Helper to get available users for a specific court dropdown (Excludes players assigned in this court AND all other parallel courts)
  const getAvailableUsersForCourt = (courtName: string, currentSelection: string) => {
    const selectedEverywhere = new Set<string>()

    // Collect all players drafted across ALL active courts (except current dropdown slot)
    Object.entries(courtDrafts).forEach(([cName, draft]) => {
      if (draft) {
        if (draft.teamAP1 && !(cName === courtName && draft.teamAP1 === currentSelection)) selectedEverywhere.add(draft.teamAP1)
        if (draft.teamAP2 && !(cName === courtName && draft.teamAP2 === currentSelection)) selectedEverywhere.add(draft.teamAP2)
        if (draft.teamBP1 && !(cName === courtName && draft.teamBP1 === currentSelection)) selectedEverywhere.add(draft.teamBP1)
        if (draft.teamBP2 && !(cName === courtName && draft.teamBP2 === currentSelection)) selectedEverywhere.add(draft.teamBP2)
      }
    })

    // Sort by lowest sets played first to promote fair-play rotation
    return [...rosterUsers]
      .filter((u) => {
        const idKey = String(u.userId || u.id)
        return !selectedEverywhere.has(idKey)
      })
      .sort((a, b) => {
        const statsA = playerStatsMap[String(a.userId || a.id)]?.totalSets || 0
        const statsB = playerStatsMap[String(b.userId || b.id)]?.totalSets || 0
        if (statsA !== statsB) return statsA - statsB
        return (a.eloScore || 0) - (b.eloScore || 0)
      })
  }

  // Auto Fair-Play Match Suggestion for the current court
  const handleAutoSuggestFairMatch = (courtName: string) => {
    const assignedInOtherCourters = new Set<string>()
    Object.entries(courtDrafts).forEach(([cName, d]) => {
      if (cName !== courtName) {
        if (d.teamAP1) assignedInOtherCourters.add(d.teamAP1)
        if (d.teamAP2) assignedInOtherCourters.add(d.teamAP2)
        if (d.teamBP1) assignedInOtherCourters.add(d.teamBP1)
        if (d.teamBP2) assignedInOtherCourters.add(d.teamBP2)
      }
    })

    const pool = [...rosterUsers]
      .filter((u) => !assignedInOtherCourters.has(String(u.userId || u.id)))
      .sort((a, b) => {
        const setsA = playerStatsMap[String(a.userId || a.id)]?.totalSets || 0
        const setsB = playerStatsMap[String(b.userId || b.id)]?.totalSets || 0
        if (setsA !== setsB) return setsA - setsB
        return (a.eloScore || 0) - (b.eloScore || 0)
      })

    if (pool.length < 2) {
      showToast('Không đủ người chơi rảnh để tự động xếp cặp!', 'error')
      return
    }

    if (pool.length >= 4) {
      const p1 = String(pool[0].userId || pool[0].id)
      const p2 = String(pool[3].userId || pool[3].id)
      const p3 = String(pool[1].userId || pool[1].id)
      const p4 = String(pool[2].userId || pool[2].id)

      setCourtDrafts((prev) => ({
        ...prev,
        [courtName]: {
          teamAP1: p1,
          teamAP2: p2,
          teamBP1: p3,
          teamBP2: p4,
        },
      }))
    } else {
      const p1 = String(pool[0].userId || pool[0].id)
      const p2 = String(pool[1].userId || pool[1].id)

      setCourtDrafts((prev) => ({
        ...prev,
        [courtName]: {
          teamAP1: p1,
          teamAP2: '',
          teamBP1: p2,
          teamBP2: '',
        },
      }))
    }
  }

  if (isLoading || !session) {
    return (
      <div className="text-center py-24 text-slate-600 text-sm animate-pulse space-y-3">
        <DuckMascot size={56} rounded="2xl" className="mx-auto" />
        <p className="font-semibold">Đang tải trung tâm điều khiển Host...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-sm w-fit"
        >
          <ArrowLeft size={15} />
          <span>Quay lại trang chủ</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['session', id] })}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <RefreshCw size={13} />
            <span>Làm mới dữ liệu</span>
          </button>

          <button
            onClick={() => navigate(`/sessions/${id}`)}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition border border-slate-200"
          >
            Xem giao diện thành viên
          </button>
        </div>
      </div>

      {/* Host Command Center Banner */}
      <div className="saas-card rounded-3xl p-6 sm:p-8 md:p-10 space-y-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-full flex items-center gap-1.5">
                <Shield size={14} className="text-slate-950" />
                <span>Host Control Center</span>
              </span>
              <span className="text-xs text-slate-600 font-semibold">Sân: {session.venueName}</span>
              <button
                onClick={() => {
                  setCourtEditNamesInput(session.courtNames || 'Sân 1, Sân 2')
                  setCourtEditSlotsInput(session.maxSlots || 8)
                  setShowCourtEditModal(true)
                }}
                className="text-xs font-bold px-3 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Nhấn để sửa tên sân hoặc nâng/giảm slot nhanh"
              >
                <span>🏸 {session.courtNames || 'Sân 1, Sân 2'} ({courtList.length} Sân)</span>
                <Edit2 size={11} className="text-slate-300" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <DuckMascot src="/duck-mascot.png" size={56} rounded="2xl" className="shadow-md border border-slate-200" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{session.title}</h1>
                <p className="text-xs sm:text-sm text-slate-600 font-normal">
                  {new Date(session.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} -{' '}
                  {new Date(session.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                  • Mục tiêu: <b>Tối thiểu {minTargetSets} set/người</b>
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Token Quick Box */}
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div
              onClick={() => setShowQrModal(true)}
              className="w-16 h-16 bg-white p-1.5 rounded-xl flex items-center justify-center cursor-pointer shadow border border-slate-200 hover:scale-105 transition"
              title="Nhấn để phóng to QR cho thành viên quét"
            >
              <QRCodeSVG value={checkinDirectUrl || session.checkinToken || 'NONE'} size={56} />
            </div>

            <div>
              <span className="text-[11px] text-slate-500 block font-bold">Mã Token điểm danh (15p):</span>
              <span className="text-2xl font-mono font-black text-slate-900 tracking-wider">
                {session.checkinToken}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-500 font-medium">
                  {session.tokenExpiresAt ? `Hết hạn: ${new Date(session.tokenExpiresAt).toLocaleTimeString()}` : 'Chưa kích hoạt'}
                </span>
                <button
                  onClick={() => setShowQrModal(true)}
                  className="text-[11px] text-slate-900 hover:underline font-bold flex items-center gap-0.5"
                >
                  <Maximize2 size={12} />
                  <span>Phóng to</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Executive Metrics Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-200 text-xs relative z-10">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-slate-500 font-bold block text-[11px]">Quân số hiện tại</span>
            <span className="text-xl font-black text-slate-900 mt-1 block">
              {session.bookedSlots} / {session.maxSlots} Người
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-slate-500 font-bold block text-[11px]">Đã điểm danh tại sân</span>
            <span className="text-xl font-black text-emerald-700 mt-1 block">{session.checkedInSlots} Đã Đến</span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-slate-500 font-bold block text-[11px]">Doanh thu đã thu</span>
            <span className="text-xl font-black text-slate-900 mt-1 block">
              {Number(report?.totalRevenue || 0).toLocaleString()}đ
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-slate-500 font-bold block text-[11px]">Tổng số trận đã đánh</span>
            <span className="text-xl font-black text-slate-900 mt-1 block">
              {matches?.length || 0} Trận ({courtList.length} Sân)
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'roster'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users size={15} />
          <span>1. Danh sách & Điểm danh ({session.participants?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('matchmaker')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'matchmaker'
              ? 'bg-slate-950 text-white shadow-md shadow-slate-900/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Swords size={15} />
          <span>2. Bắt kèo Đa Sân & Điều Tiết Set Cầu ({courtList.length} Sân)</span>
        </button>

        <button
          onClick={() => setActiveTab('settle')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'settle'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <DollarSign size={15} />
          <span>3. Quyết toán tài chính & MVP</span>
        </button>
      </div>

      {/* TAB 1: LIVE ROSTER DASHBOARD TABLE */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="saas-card rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck size={16} className="text-slate-900" />
                <span>Quản lý danh sách người chơi & Hóa đơn</span>
              </h2>
              <span className="text-xs text-slate-600 font-medium">Duyệt vào sân, xác nhận cọc và thu tiền</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3 whitespace-nowrap">#</th>
                    <th className="py-3 px-3 whitespace-nowrap">Người chơi</th>
                    <th className="py-3 px-3 whitespace-nowrap">Phân loại</th>
                    <th className="py-3 px-3 whitespace-nowrap">Số set & Sân vừa đánh</th>
                    <th className="py-3 px-3 whitespace-nowrap">Điểm danh</th>
                    <th className="py-3 px-3 whitespace-nowrap">Cọc giữ chỗ</th>
                    <th className="py-3 px-3 whitespace-nowrap">Hóa đơn</th>
                    <th className="py-3 px-3 whitespace-nowrap">Trạng thái thu</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Thao tác Host</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedParticipants.map((p, idx) => {
                    const isCheckedIn = p.checkinStatus === 'CHECKED_IN'
                    const isPaid = p.paymentStatus === 'PAID'
                    const pUid = String(p.userId || p.id)
                    const stats = playerStatsMap[pUid] || { totalSets: 0, wins: 0, losses: 0, courtHistory: [] }

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-3 font-bold text-slate-400">{idx + 1}</td>

                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <DuckMascot
                              src={p.avatarUrl || '/duck-mascot.png'}
                              size={34}
                              rounded="xl"
                              className="shrink-0 border border-slate-200 shadow-xs"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block text-sm">
                                {p.name && p.name !== 'N/A' ? p.name : (p.phone || `Tay vợt #${idx + 1}`)}
                              </span>
                              <span className="text-[10px] text-slate-500">{p.phone || 'Chưa có SĐT'}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                                p.gender === 'FEMALE'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {p.gender === 'FEMALE' ? 'Nữ' : 'Nam'}
                            </span>
                            {p.isGuest ? (
                              <span className="text-[9px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-bold">
                                Vãng lai
                              </span>
                            ) : (
                              <span className="text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold">
                                Cố định
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-black px-2 py-0.5 rounded-lg border ${
                                  stats.totalSets === 0
                                    ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                                    : stats.totalSets < minTargetSets
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                }`}
                              >
                                🏸 {stats.totalSets} set
                              </span>
                              <span className="text-[10px] text-slate-500 font-semibold">
                                ({stats.wins} Win - {stats.losses} Lose)
                              </span>
                            </div>
                            {stats.lastCourt && (
                              <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                                <MapPin size={10} className="text-slate-400" />
                                <span>Vừa đánh: <b>{stats.lastCourt}</b></span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          {isCheckedIn ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 size={11} className="text-emerald-600" />
                              <span>Đã điểm danh</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => manualCheckinMutation.mutate(p.id)}
                              disabled={manualCheckinMutation.isPending}
                              className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-800 border border-dashed border-slate-300 hover:border-emerald-400 shadow-2xs hover:shadow-xs transition active:scale-95 cursor-pointer"
                              title="Nhấp vào đây để duyệt điểm danh thủ công cho người này"
                            >
                              <Square size={13} className="text-slate-400 group-hover:text-emerald-600 transition" />
                              <span>Chưa đến (Click duyệt)</span>
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          {p.checkinStatus === 'ABSENT' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                              Đã hủy (Giữ cọc)
                            </span>
                          ) : isPaid ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap flex items-center gap-1 w-fit">
                              <CheckCircle2 size={10} className="text-emerald-600" />
                              <span>Hoàn tất</span>
                            </span>
                          ) : !p.isGuest ? (
                            <span className="text-slate-400 text-[10px] whitespace-nowrap font-medium">Cố định</span>
                          ) : Number(p.depositAmount) === 0 || p.depositStatus === 'NONE' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                              Miễn cọc
                            </span>
                          ) : (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap ${
                                p.depositStatus === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : p.depositStatus === 'FORFEITED'
                                  ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse'
                              }`}
                            >
                              {p.depositStatus === 'PAID'
                                ? 'Đã nhận cọc'
                                : p.depositStatus === 'FORFEITED'
                                ? 'Cọc đã vào quỹ'
                                : 'Chờ duyệt cọc'}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          <span className="font-mono font-bold text-slate-900 block text-xs whitespace-nowrap">
                            {p.finalFee?.toLocaleString()}đ
                          </span>
                          {p.slotWindow ? (
                            <span className="text-[10px] text-slate-900 font-extrabold block whitespace-nowrap bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 rounded mt-0.5" title={`Khung giờ đăng ký: ${p.slotWindow}`}>
                              ⏱️ {p.slotWindow}
                            </span>
                          ) : p.durationHours ? (
                            <span className="text-[10px] text-slate-900 font-extrabold block whitespace-nowrap bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 rounded mt-0.5">
                              ⏱️ Đánh {p.durationHours}h
                            </span>
                          ) : null}
                          {p.adjustmentAmount !== 0 && (
                            <span className="text-[10px] text-amber-700 font-bold block whitespace-nowrap">
                              Điều chỉnh: {p.adjustmentAmount > 0 ? '+' : ''}
                              {p.adjustmentAmount?.toLocaleString()}đ
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                              isPaid
                                ? p.paymentMethod === 'CASH'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                  : 'bg-indigo-50 text-indigo-800 border border-indigo-300'
                                : p.paymentMethod === 'CASH'
                                ? 'bg-amber-50 text-amber-900 border border-amber-300'
                                : p.paymentMethod === 'VIETQR'
                                ? 'bg-blue-50 text-blue-900 border border-blue-300'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isPaid
                              ? p.paymentMethod === 'CASH'
                                ? 'Đã thanh toán (Tiền mặt)'
                                : 'Đã thanh toán (VietQR)'
                              : p.paymentMethod === 'CASH'
                              ? 'Chưa thanh toán (Tiền mặt)'
                              : p.paymentMethod === 'VIETQR'
                              ? 'Chưa thanh toán (Chuyển khoản)'
                              : 'Chưa thanh toán'}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            {!isCheckedIn && !isPaid && (
                              <button
                                onClick={() => manualCheckinMutation.mutate(p.id)}
                                disabled={manualCheckinMutation.isPending}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black shadow-xs transition active:scale-95 whitespace-nowrap flex items-center gap-1"
                                title="Host điểm danh thủ công (Duyệt người này đã có mặt tại sân)"
                              >
                                <CheckCircle2 size={12} />
                                <span>Duyệt đến</span>
                              </button>
                            )}

                            {!isPaid && p.isGuest && Number(p.depositAmount) > 0 && p.depositStatus !== 'PAID' && (
                              <button
                                onClick={() => confirmDepositMutation.mutate(p.id)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold transition"
                                title="Xác nhận đã nhận cọc vãng lai"
                              >
                                Đã nhận cọc
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setSelectedParticipant(p)
                                setAdjustmentAmount(p.adjustmentAmount || 0)
                                setAdjustmentReason(p.adjustmentReason || '')
                              }}
                              className="p-1 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition"
                              title="Điều chỉnh tiền (về sớm, sự cố...)"
                            >
                              <Edit2 size={13} />
                            </button>

                            {!isPaid && (
                              <button
                                onClick={() => setSettlingParticipant(p)}
                                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] shadow transition active:scale-95"
                              >
                                Thu tiền
                              </button>
                            )}

                            {/* Delete / Cancel Registration Slot Button */}
                            {!isCheckedIn && p.checkinStatus !== 'ABSENT' && (
                              <button
                                onClick={() => handleRemoveParticipant(p)}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition"
                                title="Hủy đăng ký / Xóa slot nhường cho người khác"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-COURT MATCHMAKER & FAIR-PLAY SETS ROTATION */}
      {activeTab === 'matchmaker' && (
        <div className="space-y-6">
          {/* FAIR-PLAY SETS DISTRIBUTION MONITOR */}
          <div className="saas-card rounded-2xl p-5 sm:p-6 space-y-4 border border-slate-200/90 shadow-sm bg-gradient-to-r from-slate-50/50 via-white to-slate-50/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-slate-900" />
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Bảng Điều Tiết Set Cầu Công Bằng (Mục tiêu: Tối thiểu {minTargetSets} set/người)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Theo dõi số set đã đánh và đối chứng sân cụ thể của từng thành viên
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 text-[10px]">
                  🔴 Cần ưu tiên (&le;1 set)
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-[10px]">
                  🟡 Đang xoay tua
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-[10px]">
                  🟢 Đạt chỉ tiêu ({minTargetSets}+ set)
                </span>
              </div>
            </div>

            {/* Player Sets Grid with Avatar & Court History Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {rosterUsers
                .map((u) => {
                  const uid = String(u.userId || u.id)
                  const stats = playerStatsMap[uid] || { totalSets: 0, wins: 0, losses: 0, courtHistory: [] }
                  const rank = getLolRank(u.eloScore || 0)
                  return { ...u, stats, rank }
                })
                .sort((a, b) => a.stats.totalSets - b.stats.totalSets)
                .map((u) => {
                  const isLow = u.stats.totalSets <= 1
                  const isEnough = u.stats.totalSets >= minTargetSets

                  return (
                    <div
                      key={u.id}
                      className={`p-3 rounded-2xl border transition relative overflow-hidden ${
                        isLow
                          ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400/20'
                          : isEnough
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <DuckMascot
                          src={u.avatarUrl || '/duck-mascot.png'}
                          size={40}
                          rounded="xl"
                          className="shrink-0 border border-slate-200 shadow-xs"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900 text-xs truncate block" title={u.name}>
                              {u.name}
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                                isLow
                                  ? 'bg-rose-600 text-white'
                                  : isEnough
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-slate-900 text-white'
                              }`}
                            >
                              {u.stats.totalSets} set
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                            <span className="font-semibold">{u.rank.badge} ({u.eloScore || 0} LP)</span>
                            <span className="font-mono">
                              {u.stats.wins} Win - {u.stats.losses} Lose
                            </span>
                          </div>

                          {/* Court audit proof */}
                          <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 text-[9px] uppercase font-bold">Vừa đánh:</span>
                            <span className="font-bold text-slate-700 truncate max-w-[110px]">
                              {u.stats.lastCourt ? `🏸 ${u.stats.lastCourt}` : 'Chưa vào sân'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* MULTI-COURT PARALLEL MANAGEMENT TABS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 -mx-2 px-2 scrollbar-thin">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
              <Layers size={14} /> Sân:
            </span>
            {courtList.map((cName, idx) => {
              const draft = courtDrafts[cName]
              const hasDraft = draft && (draft.teamAP1 || draft.teamBP1)
              const isActive = activeCourtIndex === idx

              return (
                <div key={cName} className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setActiveCourtIndex(idx)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shrink-0 border ${
                      isActive
                        ? 'bg-slate-950 text-white border-slate-950 shadow-md'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 shadow-2xs'
                    }`}
                  >
                    <span>🏸 {cName}</span>
                    {hasDraft && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" title="Đang xếp cặp" />
                    )}
                  </button>
                  {isActive && courtList.length > 1 && (
                    <button
                      onClick={() => handleRemoveCourt(cName)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                      title={`Xóa ${cName}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )
            })}

            {/* Add Court Button opens modal to enter specific court name or auto-increment */}
            <button
              onClick={() => {
                const existingNums = courtList
                  .map((c) => {
                    const m = c.match(/(\d+)/)
                    return m ? parseInt(m[1], 10) : 0
                  })
                  .filter((n) => n > 0)
                let nextNum = 1
                while (existingNums.includes(nextNum)) {
                  nextNum++
                }
                setNewCourtNameInput(`Sân ${nextNum}`)
                setShowAddCourtModal(true)
              }}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black transition flex items-center gap-1 shrink-0 shadow-2xs active:scale-95"
              title="Mở thêm sân song song cho ca đấu này"
            >
              <Plus size={14} className="text-emerald-700 font-bold" />
              <span>+ Thêm sân</span>
            </button>
          </div>

          {/* HIGH-END SPORTS MATCHMAKER ARENA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Court Match Setup for Selected Court (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="saas-card rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Swords size={18} className="text-slate-950" />
                      <span>Sàn đấu: {currentCourtName}</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bắt cặp đối đầu cân bằng • Tự động tính Elo & Lưu vết sân đã đánh
                    </p>
                  </div>

                  <button
                    onClick={() => handleAutoSuggestFairMatch(currentCourtName)}
                    className="px-3.5 py-2 bg-slate-950 hover:bg-slate-900 text-white font-black rounded-xl text-xs shadow-md flex items-center gap-1.5 transition active:scale-95 shrink-0"
                  >
                    <Sparkles size={14} className="text-amber-400" />
                    <span>Ghép Kèo Công Bằng (Ưu tiên người ít set)</span>
                  </button>
                </div>

                {/* Light & Clean Sports Arena Layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* TEAM BLUE CARD */}
                  <div className="bg-blue-50/40 rounded-2xl p-5 border border-blue-200/80 space-y-4 shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between pb-2.5 border-b border-blue-200/60">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs" />
                        <span className="font-black text-xs text-blue-700 tracking-wider uppercase">TEAM BLUE</span>
                      </div>
                      <span className="text-[10px] text-blue-600/80 font-bold uppercase tracking-wider bg-blue-100/60 px-2 py-0.5 rounded-md">Cặp đấu 1</span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">Player 1</label>
                      <select
                        value={currentDraft.teamAP1}
                        onChange={(e) => updateCurrentDraft('teamAP1', e.target.value)}
                        className="w-full bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-2.5 text-slate-900 font-bold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none text-xs shadow-xs transition"
                      >
                        <option value="">Chọn tay vợt...</option>
                        {getAvailableUsersForCourt(currentCourtName, currentDraft.teamAP1).map((u) => {
                          const rank = getPlayerRankDisplay(u.eloScore || 0, u.placementMatches ?? 5)
                          const stats = playerStatsMap[String(u.userId || u.id)]
                          return (
                            <option key={u.id} value={String(u.userId || u.id)}>
                              {u.name} • {rank.name} ({u.eloScore || 0} LP) | 🏸 {stats?.totalSets || 0} set{' '}
                              {u.isGuest ? '[Vãng lai]' : ''}
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">Player 2 (Đánh đôi)</label>
                      <select
                        value={currentDraft.teamAP2}
                        onChange={(e) => updateCurrentDraft('teamAP2', e.target.value)}
                        className="w-full bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-2.5 text-slate-900 font-bold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none text-xs shadow-xs transition"
                      >
                        <option value="">(Không có - Đánh đơn)</option>
                        {getAvailableUsersForCourt(currentCourtName, currentDraft.teamAP2).map((u) => {
                          const rank = getPlayerRankDisplay(u.eloScore || 0, u.placementMatches ?? 5)
                          const stats = playerStatsMap[String(u.userId || u.id)]
                          return (
                            <option key={u.id} value={String(u.userId || u.id)}>
                              {u.name} • {rank.name} ({u.eloScore || 0} LP) | 🏸 {stats?.totalSets || 0} set{' '}
                              {u.isGuest ? '[Vãng lai]' : ''}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>

                  {/* TEAM RED CARD */}
                  <div className="bg-rose-50/40 rounded-2xl p-5 border border-rose-200/80 space-y-4 shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between pb-2.5 border-b border-rose-200/60">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shadow-xs" />
                        <span className="font-black text-xs text-rose-700 tracking-wider uppercase">TEAM RED</span>
                      </div>
                      <span className="text-[10px] text-rose-600/80 font-bold uppercase tracking-wider bg-rose-100/60 px-2 py-0.5 rounded-md">Cặp đấu 2</span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">Player 1</label>
                      <select
                        value={currentDraft.teamBP1}
                        onChange={(e) => updateCurrentDraft('teamBP1', e.target.value)}
                        className="w-full bg-white border border-slate-200 hover:border-rose-400 rounded-xl p-2.5 text-slate-900 font-bold focus:border-rose-600 focus:ring-2 focus:ring-rose-100 focus:outline-none text-xs shadow-xs transition"
                      >
                        <option value="">Chọn tay vợt...</option>
                        {getAvailableUsersForCourt(currentCourtName, currentDraft.teamBP1).map((u) => {
                          const rank = getPlayerRankDisplay(u.eloScore || 0, u.placementMatches ?? 5)
                          const stats = playerStatsMap[String(u.userId || u.id)]
                          return (
                            <option key={u.id} value={String(u.userId || u.id)}>
                              {u.name} • {rank.name} ({u.eloScore || 0} LP) | 🏸 {stats?.totalSets || 0} set{' '}
                              {u.isGuest ? '[Vãng lai]' : ''}
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">Player 2 (Đánh đôi)</label>
                      <select
                        value={currentDraft.teamBP2}
                        onChange={(e) => updateCurrentDraft('teamBP2', e.target.value)}
                        className="w-full bg-white border border-slate-200 hover:border-rose-400 rounded-xl p-2.5 text-slate-900 font-bold focus:border-rose-600 focus:ring-2 focus:ring-rose-100 focus:outline-none text-xs shadow-xs transition"
                      >
                        <option value="">(Không có - Đánh đơn)</option>
                        {getAvailableUsersForCourt(currentCourtName, currentDraft.teamBP2).map((u) => {
                          const rank = getPlayerRankDisplay(u.eloScore || 0, u.placementMatches ?? 5)
                          const stats = playerStatsMap[String(u.userId || u.id)]
                          return (
                            <option key={u.id} value={String(u.userId || u.id)}>
                              {u.name} • {rank.name} ({u.eloScore || 0} LP) | 🏸 {stats?.totalSets || 0} set{' '}
                              {u.isGuest ? '[Vãng lai]' : ''}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 1-Touch Record Buttons for Current Court */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                    <span>Ghi nhận kết quả trận đấu trên [{currentCourtName}]:</span>
                    <span>1 chạm (+1 Win / -1 Lose / +1 Set cho cả cặp)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <button
                      disabled={
                        !currentDraft.teamAP1 || !currentDraft.teamBP1 || recordMatchMutation.isPending
                      }
                      onClick={() =>
                        recordMatchMutation.mutate({ winningTeam: 'A', court: currentCourtName })
                      }
                      className="py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black rounded-2xl text-xs shadow-md shadow-blue-500/20 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <span className="w-2 h-2 rounded-full bg-white" />
                      <span>Team Blue Thắng (+1 Win)</span>
                    </button>

                    <button
                      disabled={
                        !currentDraft.teamAP1 || !currentDraft.teamBP1 || recordMatchMutation.isPending
                      }
                      onClick={() =>
                        recordMatchMutation.mutate({ winningTeam: 'B', court: currentCourtName })
                      }
                      className="py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-black rounded-2xl text-xs shadow-md shadow-rose-500/20 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <span className="w-2 h-2 rounded-full bg-white" />
                      <span>Team Red Thắng (+1 Win)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Matches Feed with Court Indicators (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="saas-card rounded-3xl p-6 sm:p-8 space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center justify-between pb-3.5 border-b border-slate-200">
                  <span>Lịch sử các trận đấu theo Sân</span>
                  <span className="text-xs text-slate-500 font-medium">{matches?.length || 0} trận</span>
                </h3>

                <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                  {matches?.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Chưa có trận nào được ghi nhận
                    </div>
                  ) : (
                    matches?.map((m) => (
                      <div
                        key={m.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 hover:border-slate-300 transition shadow-sm text-xs"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <span className="font-bold px-2.5 py-0.5 bg-slate-100 text-slate-900 rounded-md text-[11px] border border-slate-200">
                            🏸 {m.courtName || 'Sân chính'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(m.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <button
                              onClick={() => openEditMatchModal(m)}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer border border-slate-200 hover:border-slate-900 active:scale-95"
                              title="Sửa trận đấu: Đổi đội thắng, đổi người chơi hoặc xóa trận"
                            >
                              <Edit2 size={10} />
                              <span>Sửa</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div
                            className={`font-bold flex items-center justify-between ${
                              m.winningTeam === 'A' ? 'text-slate-950' : 'text-slate-400'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                              <span>{m.teamAPlayer1Name} {m.teamAPlayer2Name && `+ ${m.teamAPlayer2Name}`}</span>
                            </span>
                            {m.winningTeam === 'A' && (
                              <span className="text-[10px] bg-cyan-50 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-md font-black">
                                👑 THẮNG
                              </span>
                            )}
                          </div>
                          <div
                            className={`font-bold flex items-center justify-between ${
                              m.winningTeam === 'B' ? 'text-slate-950' : 'text-slate-400'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>{m.teamBPlayer1Name} {m.teamBPlayer2Name && `+ ${m.teamBPlayer2Name}`}</span>
                            </span>
                            {m.winningTeam === 'B' && (
                              <span className="text-[10px] bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-black">
                                👑 THẮNG
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FINANCIAL SETTLEMENT DASHBOARD */}
      {activeTab === 'settle' && report && (
        <div className="space-y-6">
          {/* Session MVP Highlight Box */}
          {report.mvpUserId && report.mvpWins && report.mvpWins > 0 && (
            (() => {
              const mvpParticipant = session?.participants?.find(
                (p) => String(p.userId || p.id) === String(report.mvpUserId) || p.name === report.mvpName
              )
              const mvpAvatar = report.mvpAvatarUrl || mvpParticipant?.avatarUrl || '/duck-mascot.png'

              return (
                <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 rounded-3xl p-5 sm:p-8 text-slate-950 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden">
                  <div className="flex items-center gap-3.5 sm:gap-4 relative z-10 w-full sm:w-auto">
                    <div className="relative shrink-0">
                      <DuckMascot
                        src={mvpAvatar}
                        size={56}
                        rounded="2xl"
                        className="border-2 border-slate-950/80 shadow-xl"
                      />
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center text-xs shadow-md border border-amber-400">
                        👑
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">
                        <span>Vinh danh MVP Ca Đấu</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black truncate">{report.mvpName}</h3>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">
                        Thắng nhiều nhất: <b>{report.mvpWins} Thắng</b> (-{report.mvpLosses} Thua)
                      </p>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto bg-white/90 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-yellow-200 text-center sm:text-right shrink-0 shadow-md relative z-10">
                    <span className="text-[10px] sm:text-[11px] font-black uppercase text-amber-900 block">
                      Phần thưởng MVP Ca Đấu
                    </span>
                    <span className="font-black text-xs sm:text-sm text-slate-950 block mt-0.5">
                      🥤 Tặng 01 Nước giải khát Revive / Pocari
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-600 block mt-0.5 sm:mt-1 font-semibold">
                      (Host trao tặng trực tiếp tại sân)
                    </span>
                  </div>
                </div>
              )
            })()
          )}

          <div className="saas-card rounded-3xl p-6 sm:p-8 md:p-10 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Receipt size={18} className="text-slate-900" />
                  <span>Báo cáo Quyết toán Doanh thu & Chi phí Ca</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Báo cáo tài chính minh bạch cho Host</p>
              </div>

              <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-800 rounded-full">
                {session.title}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Thu */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3.5 text-xs">
                <span className="font-bold text-slate-900 block text-sm border-b border-slate-200 pb-2">
                  1. Tổng các khoản THU
                </span>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Tổng người chơi đăng ký:</span>
                  <span className="font-bold text-slate-900">{report.totalPlayers} người</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Đã thanh toán đủ tiền:</span>
                  <span className="font-bold text-emerald-700">{report.paidPlayers} người</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Chưa hoàn tất thanh toán:</span>
                  <span className="font-bold text-rose-600">{report.unpaidPlayers} người</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Tiền cọc vãng lai đã thu:</span>
                  <span className="font-bold text-slate-900">
                    {Number(report.totalDepositCollected).toLocaleString()}đ
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-black text-slate-900">
                  <span>Tổng tiền sân THU ĐƯỢC:</span>
                  <span className="text-emerald-700">{Number(report.totalRevenue).toLocaleString()}đ</span>
                </div>
              </div>

              {/* Right Column: Chi & Net Profit */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3.5 text-xs">
                <span className="font-bold text-slate-900 block text-sm border-b border-slate-200 pb-2">
                  2. Tổng các khoản CHI & Lợi Nhuận
                </span>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Tiền thuê sân (Host trả chủ sân):</span>
                  <span className="font-bold text-slate-900">{Number(report.costCourt).toLocaleString()}đ</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Tiền cầu lông (Ống cầu tiêu hao):</span>
                  <span className="font-bold text-slate-900">
                    {Number(report.costShuttlecock).toLocaleString()}đ
                  </span>
                </div>

                {Number(report.costDrinks || 0) > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tiền trà đá / nước uống:</span>
                    <span className="font-bold text-slate-900">
                      {Number(report.costDrinks).toLocaleString()}đ
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-slate-600">
                  <span>Tổng chi phí vận hành:</span>
                  <span className="font-bold text-rose-600">
                    {Number(report.totalExpenses).toLocaleString()}đ
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-black">
                  <span className="text-slate-900">LỢI NHUẬN RÒNG (Net):</span>
                  <span
                    className={`text-base font-black ${
                      report.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {Number(report.netProfit).toLocaleString()}đ
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Override Bill Modal */}
      {selectedParticipant && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Điều chỉnh tiền: {selectedParticipant.name}</h3>
              <button
                onClick={() => setSelectedParticipant(null)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Số tiền điều chỉnh (VND) (Nhập số âm nếu giảm, dương nếu tăng):
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentAmount((prev) => -Math.abs(prev || 10000))}
                    className={`px-3 py-2 rounded-xl font-bold text-xs border transition ${
                      adjustmentAmount < 0
                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    - Giảm tiền
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentAmount((prev) => Math.abs(prev || 10000))}
                    className={`px-3 py-2 rounded-xl font-bold text-xs border transition ${
                      adjustmentAmount >= 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    + Tăng phụ thu
                  </button>
                  <div className="flex-1">
                    <CurrencyInput
                      value={Math.abs(adjustmentAmount)}
                      onChange={(val) => setAdjustmentAmount(adjustmentAmount < 0 ? -val : val)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Lý do điều chỉnh:</label>
                <input
                  type="text"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Về sớm 1 tiếng / Sự cố sân..."
                  className="w-full border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-[11px] text-slate-600">
                <p>Tiền gốc: {selectedParticipant.baseFee?.toLocaleString()}đ</p>
                <p className="font-bold text-slate-900">
                  Thành tiền mới:{' '}
                  {Math.max(0, selectedParticipant.baseFee + adjustmentAmount).toLocaleString()}đ
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setSelectedParticipant(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                disabled={overrideBillMutation.isPending}
                onClick={() => overrideBillMutation.mutate()}
                className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow active:scale-95"
              >
                Lưu điều chỉnh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Quét mã để điểm danh
              </span>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-200 inline-block">
              <QRCodeSVG value={checkinDirectUrl || session.checkinToken || 'NONE'} size={240} />
            </div>

            <div className="space-y-1">
              <span className="text-3xl font-mono font-black text-slate-900 tracking-wider">
                {session.checkinToken}
              </span>
              <p className="text-xs text-slate-500 font-medium">
                Mã làm mới mỗi 15 phút. Quét bằng Camera / Zalo hoặc bật GPS tại sân.
              </p>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow active:scale-95"
            >
              Đóng cửa sổ QR
            </button>
          </div>
        </div>
      )}

      {/* Settle Payment Modal (Thu tiền - Cash vs VietQR) */}
      {settlingParticipant && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <DollarSign size={20} className="text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">Xác nhận thu tiền sân</h3>
              </div>
              <button
                onClick={() => setSettlingParticipant(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Người chơi:</span>
                <span className="font-bold text-slate-900 text-sm">{settlingParticipant.name}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Số điện thoại:</span>
                <span className="font-mono text-slate-700">{settlingParticipant.phone}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Loại khách:</span>
                <span className="font-bold text-slate-800">
                  {settlingParticipant.isGuest ? 'Khách Vãng lai' : 'Thành viên CLB'}
                </span>
              </div>
              {settlingParticipant.paymentMethod && (
                <div className="flex justify-between items-center text-slate-600">
                  <span>Khách chọn trước:</span>
                  <span className="font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[11px]">
                    {settlingParticipant.paymentMethod === 'CASH' ? '💵 Tiền mặt' : '⚡ Chuyển khoản VietQR'}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900">
                <span>Số tiền cần thu:</span>
                <span className="text-base font-black text-emerald-700 font-mono">
                  {Number(settlingParticipant.remainingAmount).toLocaleString()}đ
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-slate-500 font-medium text-center">
                Chọn hình thức nhận tiền thực tế để hoàn tất quyết toán:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={settlePaymentMutation.isPending}
                  onClick={() => {
                    settlePaymentMutation.mutate(
                      { participantId: settlingParticipant.id, method: 'CASH' },
                      {
                        onSuccess: () => setSettlingParticipant(null),
                      }
                    )
                  }}
                  className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition"
                >
                  <span>💵 Thu TIỀN MẶT</span>
                </button>

                <button
                  disabled={settlePaymentMutation.isPending}
                  onClick={() => {
                    settlePaymentMutation.mutate(
                      { participantId: settlingParticipant.id, method: 'VIETQR' },
                      {
                        onSuccess: () => setSettlingParticipant(null),
                      }
                    )
                  }}
                  className="py-3 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition"
                >
                  <span>⚡ Thu qua VIETQR</span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSettlingParticipant(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                Đóng / Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xóa / Hủy Slot Thành Viên (Replaces browser window.confirm) */}
      {confirmRemoveParticipant && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-2xl border border-rose-200">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">Hủy lượt đăng ký slot ca</h3>
                <p className="text-[11px] text-slate-500 font-medium">{confirmRemoveParticipant.name}</p>
              </div>
            </div>

            {confirmRemoveParticipant.isGuest && confirmRemoveParticipant.depositStatus === 'PAID' ? (
              <div className="space-y-3 text-xs">
                <p className="text-slate-700 leading-relaxed">
                  Người này là <b>Khách Vãng Lai</b> đã chuyển khoản cọc{' '}
                  <b className="text-emerald-700">{confirmRemoveParticipant.depositAmount.toLocaleString()}đ</b> và không tới sân (Bỏ kèo).
                </p>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 text-[11px] space-y-1">
                  <p className="font-bold">Lựa chọn cách xử lý tiền cọc:</p>
                  <p>• <b>Giữ cọc vào quỹ:</b> Slot được mở lại, tiền cọc 20k được ghi nhận vào doanh thu ca.</p>
                  <p>• <b>Hoàn tiền cọc:</b> Slot được mở lại và xóa hoàn toàn khỏi doanh thu.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  <button
                    disabled={removeParticipantMutation.isPending}
                    onClick={() => {
                      const pid = confirmRemoveParticipant.id
                      setConfirmRemoveParticipant(null)
                      removeParticipantMutation.mutate({ participantId: pid, forfeitDeposit: true })
                    }}
                    className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-sm transition active:scale-95 text-center"
                  >
                    Giữ cọc vào quỹ ca
                  </button>
                  <button
                    disabled={removeParticipantMutation.isPending}
                    onClick={() => {
                      const pid = confirmRemoveParticipant.id
                      setConfirmRemoveParticipant(null)
                      removeParticipantMutation.mutate({ participantId: pid, forfeitDeposit: false })
                    }}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition active:scale-95 text-center"
                  >
                    Hoàn tiền cọc & Hủy
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-slate-700 leading-relaxed">
                  Bạn có chắc chắn muốn hủy lượt đăng ký của <b className="text-slate-900">[{confirmRemoveParticipant.name}]</b> để nhường slot trống cho người khác đăng ký không?
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setConfirmRemoveParticipant(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Không hủy
                  </button>
                  <button
                    disabled={removeParticipantMutation.isPending}
                    onClick={() => {
                      const pid = confirmRemoveParticipant.id
                      setConfirmRemoveParticipant(null)
                      removeParticipantMutation.mutate({ participantId: pid, forfeitDeposit: false })
                    }}
                    className="px-4 py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition"
                  >
                    Xác nhận hủy slot
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Thêm Sân (Nhập tên sân tùy ý hoặc tự động + 8 slot) */}
      {showAddCourtModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-emerald-600 font-bold" />
                <h3 className="font-black text-slate-900 text-sm">Thêm Sân Mới Vào Ca</h3>
              </div>
              <button
                onClick={() => setShowAddCourtModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Tên sân muốn thêm (VD: Sân 3, Sân 9, Sân VIP...):
                </label>
                <input
                  type="text"
                  value={newCourtNameInput}
                  onChange={(e) => setNewCourtNameInput(e.target.value)}
                  placeholder="Nhập tên sân (VD: Sân 3)"
                  autoFocus
                  className="w-full border border-slate-300 rounded-xl p-3 text-slate-900 font-bold text-sm focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-950 space-y-1 text-[11px]">
                <p className="font-bold flex items-center gap-1">
                  <span>⚡ Tự động tính toán quân số:</span>
                </p>
                <p>
                  • Hiện tại: <b>{courtList.length} Sân ({session.maxSlots} người)</b>
                </p>
                <p>
                  • Sau khi thêm: <b>{courtList.length + 1} Sân ({(courtList.length + 1) * 8} người)</b> (Mỗi sân +8 slots)
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddCourtModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleAddCourt()}
                className="px-4 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition"
              >
                Xác nhận thêm sân
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Sân (Replaces browser window.confirm) */}
      {confirmRemoveCourt && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 pb-2 border-b border-slate-100">
              <div className="p-2 bg-rose-50 rounded-xl border border-rose-200">
                <Trash2 size={18} />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Xóa sân khỏi ca</h3>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Bạn có chắc chắn muốn đóng và xóa <b>[{confirmRemoveCourt}]</b> khỏi ca đánh này không?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmRemoveCourt(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Giữ lại
              </button>
              <button
                onClick={() => {
                  const target = confirmRemoveCourt
                  setConfirmRemoveCourt(null)
                  const remainingCourts = courtList.filter((c) => c !== target)
                  const updatedList = remainingCourts.join(', ')
                  const newCourtCount = remainingCourts.length
                  const newMaxSlots = Math.max(8, newCourtCount * 8)
                  setActiveCourtIndex(0)
                  updateCourtsMutation.mutate({ newCourtNames: updatedList, newMaxSlots })
                  showToast(`Đã xóa [${target}] & giảm về ${newMaxSlots} slots!`, 'info')
                }}
                className="px-4 py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow active:scale-95 transition"
              >
                Xóa sân này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cập Nhật Danh Sách Sân & Slot (Replaces browser window.prompt) */}
      {showCourtEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-slate-900" />
                <h3 className="font-black text-slate-900 text-sm">Cấu hình Sân & Số Slot của ca</h3>
              </div>
              <button
                onClick={() => setShowCourtEditModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Danh sách sân (ngăn cách bằng dấu phẩy):
                </label>
                <input
                  type="text"
                  value={courtEditNamesInput}
                  onChange={(e) => setCourtEditNamesInput(e.target.value)}
                  placeholder="Sân 1, Sân 2, Sân 3"
                  className="w-full border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Số lượng slot tối đa (Max Slots):
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={courtEditSlotsInput}
                  onChange={(e) => setCourtEditSlotsInput(Number(e.target.value) || 8)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowCourtEditModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                disabled={updateCourtsMutation.isPending || !courtEditNamesInput.trim()}
                onClick={() => {
                  setShowCourtEditModal(false)
                  updateCourtsMutation.mutate({
                    newCourtNames: courtEditNamesInput.trim(),
                    newMaxSlots: courtEditSlotsInput,
                  })
                }}
                className="px-4 py-2 text-xs font-black bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow active:scale-95 transition"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SỬA TRẬN ĐẤU (Đổi đội thắng, Đổi người chơi, Sân đấu, Xóa trận) */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-950 text-white flex items-center justify-center font-bold text-sm shadow">
                  ✏️
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Chỉnh Sửa Trận Đấu</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Đổi đội thắng, sửa tên người chơi hoặc xóa trận để hoàn tác
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingMatch(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick 1-Touch Toggle Winning Team */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Đội Chiến Thắng (Nhấp để đổi):
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEditMatchWinningTeam('A')}
                  className={`py-3 px-4 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 border-2 cursor-pointer ${
                    editMatchWinningTeam === 'A'
                      ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-md shadow-blue-500/10'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span>Team Blue (Đội A)</span>
                  {editMatchWinningTeam === 'A' && <span>👑</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setEditMatchWinningTeam('B')}
                  className={`py-3 px-4 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 border-2 cursor-pointer ${
                    editMatchWinningTeam === 'B'
                      ? 'bg-rose-50 border-rose-600 text-rose-900 shadow-md shadow-rose-500/10'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                  <span>Team Red (Đội B)</span>
                  {editMatchWinningTeam === 'B' && <span>👑</span>}
                </button>
              </div>
            </div>

            {/* Edit Team Members */}
            <div className="space-y-4 pt-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Danh Sách Người Chơi Của 2 Đội:
              </label>

              {/* Team Blue */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>Team Blue (Đội A)</span>
                  </span>
                  {editMatchWinningTeam === 'A' && (
                    <span className="text-[10px] font-black px-2 py-0.5 bg-blue-600 text-white rounded-md">
                      👑 Thắng
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Vị trí 1 (Bắt buộc):</label>
                    <select
                      value={editMatchTeamAP1}
                      onChange={(e) => setEditMatchTeamAP1(e.target.value)}
                      className="w-full bg-white border border-blue-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                    >
                      <option value="">-- Chọn Người 1 --</option>
                      {rosterUsers.map((p) => {
                        const uid = String(p.userId || p.id)
                        return (
                          <option key={uid} value={uid}>
                            {p.name} ({p.eloScore || 0} LP)
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Vị trí 2 (Đánh đôi):</label>
                    <select
                      value={editMatchTeamAP2}
                      onChange={(e) => setEditMatchTeamAP2(e.target.value)}
                      className="w-full bg-white border border-blue-300 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                    >
                      <option value="">-- Trống (Đánh đơn) --</option>
                      {rosterUsers.map((p) => {
                        const uid = String(p.userId || p.id)
                        return (
                          <option key={uid} value={uid}>
                            {p.name} ({p.eloScore || 0} LP)
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Team Red */}
              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                    <span>Team Red (Đội B)</span>
                  </span>
                  {editMatchWinningTeam === 'B' && (
                    <span className="text-[10px] font-black px-2 py-0.5 bg-rose-600 text-white rounded-md">
                      👑 Thắng
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Vị trí 1 (Bắt buộc):</label>
                    <select
                      value={editMatchTeamBP1}
                      onChange={(e) => setEditMatchTeamBP1(e.target.value)}
                      className="w-full bg-white border border-rose-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600"
                    >
                      <option value="">-- Chọn Người 1 --</option>
                      {rosterUsers.map((p) => {
                        const uid = String(p.userId || p.id)
                        return (
                          <option key={uid} value={uid}>
                            {p.name} ({p.eloScore || 0} LP)
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Vị trí 2 (Đánh đôi):</label>
                    <select
                      value={editMatchTeamBP2}
                      onChange={(e) => setEditMatchTeamBP2(e.target.value)}
                      className="w-full bg-white border border-rose-300 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-600"
                    >
                      <option value="">-- Trống (Đánh đơn) --</option>
                      {rosterUsers.map((p) => {
                        const uid = String(p.userId || p.id)
                        return (
                          <option key={uid} value={uid}>
                            {p.name} ({p.eloScore || 0} LP)
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Court Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sân thi đấu:</label>
                <select
                  value={editMatchCourtName}
                  onChange={(e) => setEditMatchCourtName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                >
                  {courtList.map((c) => (
                    <option key={c} value={c}>
                      🏸 {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bottom Modal Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteMatchId(editingMatch.id)}
                className="px-3 py-2.5 text-xs font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-xl transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                title="Xóa trận đấu này và hoàn tác số set/rank"
              >
                <Trash2 size={14} />
                <span>Xóa trận này</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMatch(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={updateMatchMutation.isPending}
                  onClick={handleSaveEditedMatch}
                  className="px-5 py-2.5 text-xs font-black bg-slate-950 hover:bg-slate-800 text-white rounded-xl shadow-md active:scale-95 transition cursor-pointer disabled:opacity-50"
                >
                  {updateMatchMutation.isPending ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA / HOÀN TÁC TRẬN ĐẤU */}
      {confirmDeleteMatchId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">Xác nhận xóa trận đấu</h3>
                <p className="text-[11px] text-slate-500 font-medium">Hoàn tác hoàn toàn lượt trận</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-950 space-y-1.5 text-xs">
              <p className="font-bold">⚡ Sau khi xóa trận:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-900 font-medium">
                <li>Trận đấu sẽ bị xóa khỏi lịch sử của sân.</li>
                <li>Số set đã đánh (-1 set) của 4 người chơi được hoàn tác.</li>
                <li>Tỉ số Thắng / Thua và điểm Elo/Rank được tính lại chuẩn xác.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteMatchId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={deleteMatchMutation.isPending}
                onClick={() => deleteMatchMutation.mutate(confirmDeleteMatchId)}
                className="px-4 py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition cursor-pointer"
              >
                {deleteMatchMutation.isPending ? 'Đang xóa...' : 'Đồng ý Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
