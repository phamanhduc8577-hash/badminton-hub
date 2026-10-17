import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { SessionItem, Match, HostReport, Participant } from '../types'
import { QRCodeSVG } from 'qrcode.react'
import { DuckMascot } from '../components/DuckMascot'
import { useToast } from '../components/ToastProvider'
import { getLolRank } from '../lib/ranks'
import { PlayerSelect } from '../components/PlayerSelect'
import { BottomSheet } from '../components/BottomSheet'
import { formatMatchTime, formatVnTime } from '../lib/dateUtils'
import { getEffectiveSessionStatus, isSessionClosed, SESSION_STATUS_LABEL } from '../lib/sessionStatus'
import { RosterCard } from '../components/host/RosterCard'
import { ParticipantActionsSheet } from '../components/host/ParticipantActionsSheet'
import { UndoPaymentSheet } from '../components/host/UndoPaymentSheet'
import { OverrideBillSheet, OverrideBillPayload } from '../components/host/OverrideBillSheet'
import { CourtSettingsSheet } from '../components/host/CourtSettingsSheet'
import { ConfirmSheet } from '../components/host/ConfirmSheet'
import { CancelSessionSheet } from '../components/host/CancelSessionSheet'
import { UndoSnackbar } from '../components/host/UndoSnackbar'
import {
  HostParticipant,
  PlayerSetStats,
  EMPTY_STATS,
  canConfirmDeposit,
  editBillBlockReason,
  removeBlockReason,
  formatVnd,
  getErrorMessage,
  participantDisplayName,
  paymentMethodLabel,
} from '../components/host/hostUtils'
import {
  Users,
  Swords,
  DollarSign,
  Edit2,
  RefreshCw,
  Maximize2,
  Shield,
  ArrowLeft,
  Receipt,
  UserCheck,
  Sparkles,
  Layers,
  BarChart3,
  MapPin,
  CheckCircle2,
  Plus,
  Trash2,
  Square,
  Undo2,
  RotateCcw,
  Settings2,
  ChevronDown,
  QrCode,
  Loader2,
} from 'lucide-react'

interface CourtDraft {
  teamAP1: string
  teamAP2: string
  teamBP1: string
  teamBP2: string
}

const EMPTY_DRAFT: CourtDraft = { teamAP1: '', teamAP2: '', teamBP1: '', teamBP2: '' }

type RosterFilter = 'ALL' | 'NOT_ARRIVED' | 'UNPAID'

interface UndoMatchInfo {
  matchId: number
  court: string
  draft: CourtDraft
  message: string
  key: number
}

/** Cập nhật 1 người trong cache ['session', id] (dùng cho cập nhật lạc quan) */
const patchParticipantInSession = (
  session: SessionItem,
  participantId: number,
  patch: Partial<Participant>,
  checkedInDelta: number
): SessionItem => ({
  ...session,
  checkedInSlots: Math.max(0, (session.checkedInSlots || 0) + checkedInDelta),
  participants: session.participants?.map((p) => (p.id === participantId ? { ...p, ...patch } : p)),
})

/** Số slot gợi ý theo số sân (8 người/sân), không bao giờ thấp hơn số người đã đăng ký */
const suggestMaxSlots = (courtCount: number, bookedSlots: number, minimum = 0): number | undefined => {
  const suggested = Math.max(minimum, courtCount * 8)
  return suggested >= bookedSlots ? suggested : undefined
}

const isNotArrived = (p: Participant) => p.checkinStatus !== 'CHECKED_IN' && p.checkinStatus !== 'ABSENT'
const isUnpaid = (p: Participant) => p.paymentStatus !== 'PAID' && p.checkinStatus !== 'ABSENT'

export const HostDashboardView: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  // State tabs: 'roster' | 'matchmaker' | 'settle'
  const [activeTab, setActiveTab] = useState<'roster' | 'matchmaker' | 'settle'>('roster')

  // Banner thu gọn trên mobile (QR + chỉ số nằm sau nút "Chi tiết ca")
  const [showSessionDetails, setShowSessionDetails] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)

  // Lọc nhanh danh sách điểm danh
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('ALL')

  // Các popup thao tác theo người chơi: lưu id để luôn hiển thị dữ liệu mới nhất từ cache
  const [menuParticipantId, setMenuParticipantId] = useState<number | null>(null)
  const [editingBillId, setEditingBillId] = useState<number | null>(null)
  const [settlingId, setSettlingId] = useState<number | null>(null)
  const [undoPaymentId, setUndoPaymentId] = useState<number | null>(null)
  const [confirmCancelCheckinId, setConfirmCancelCheckinId] = useState<number | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null)

  // Trạng thái chờ theo từng người (đếm số thao tác đang chạy của mỗi người)
  const [pendingCounts, setPendingCounts] = useState<Record<number, number>>({})
  const setRowPending = useCallback((participantId: number, on: boolean) => {
    setPendingCounts((prev) => {
      const next = { ...prev }
      const count = (next[participantId] || 0) + (on ? 1 : -1)
      if (count <= 0) delete next[participantId]
      else next[participantId] = count
      return next
    })
  }, [])
  const isRowPending = (participantId: number) => !!pendingCounts[participantId]

  // Sân
  const [confirmRemoveCourt, setConfirmRemoveCourt] = useState<string | null>(null)
  const [showAddCourtModal, setShowAddCourtModal] = useState(false)
  const [newCourtNameInput, setNewCourtNameInput] = useState('')
  const [showCourtEditModal, setShowCourtEditModal] = useState(false)

  // Hủy ca
  const [showCancelSession, setShowCancelSession] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSessionError, setCancelSessionError] = useState('')

  // Trận đấu
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [editMatchTeamAP1, setEditMatchTeamAP1] = useState<string>('')
  const [editMatchTeamAP2, setEditMatchTeamAP2] = useState<string>('')
  const [editMatchTeamBP1, setEditMatchTeamBP1] = useState<string>('')
  const [editMatchTeamBP2, setEditMatchTeamBP2] = useState<string>('')
  const [editMatchWinningTeam, setEditMatchWinningTeam] = useState<'A' | 'B'>('A')
  const [editMatchCourtName, setEditMatchCourtName] = useState<string>('')
  const [confirmDeleteMatchId, setConfirmDeleteMatchId] = useState<number | null>(null)
  const [showSetsGrid, setShowSetsGrid] = useState(false)
  const [undoMatch, setUndoMatch] = useState<UndoMatchInfo | null>(null)

  // Active Court Selected for Multi-Court Matchmaking
  const [activeCourtIndex, setActiveCourtIndex] = useState<number>(0)

  // Multi-court drafts: Court Name -> CourtDraft (Persisted in localStorage across F5)
  const [courtDrafts, setCourtDrafts] = useState<Record<string, CourtDraft>>(() => {
    try {
      const saved = localStorage.getItem(`smashflow_drafts_${id}`)
      if (!saved) return {}
      const parsed: Record<string, CourtDraft> = JSON.parse(saved)
      const seen = new Set<string>()
      const cleaned: Record<string, CourtDraft> = {}
      for (const [court, draft] of Object.entries(parsed)) {
        if (!draft) continue
        const d: CourtDraft = { ...EMPTY_DRAFT }
        if (draft.teamAP1 && !seen.has(draft.teamAP1)) { d.teamAP1 = draft.teamAP1; seen.add(draft.teamAP1) }
        if (draft.teamAP2 && !seen.has(draft.teamAP2)) { d.teamAP2 = draft.teamAP2; seen.add(draft.teamAP2) }
        if (draft.teamBP1 && !seen.has(draft.teamBP1)) { d.teamBP1 = draft.teamBP1; seen.add(draft.teamBP1) }
        if (draft.teamBP2 && !seen.has(draft.teamBP2)) { d.teamBP2 = draft.teamBP2; seen.add(draft.teamBP2) }
        cleaned[court] = d
      }
      return cleaned
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

  const {
    data: session,
    isLoading,
    isError,
    error: sessionError,
    refetch: refetchSession,
    isFetching: sessionFetching,
  } = useQuery<SessionItem>({
    queryKey: ['session', id],
    queryFn: async () => {
      const res = await api.get(`/sessions/${id}`)
      return res.data
    },
    // Ca đang diễn ra: tự tải lại 15s để thấy người tự điểm danh / chuyển khoản
    refetchInterval: (query) => {
      const s = query.state.data
      return s && getEffectiveSessionStatus(s) === 'ACTIVE' ? 15000 : false
    },
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
    enabled: !!id,
  })

  const participants = useMemo(() => (session?.participants ?? []) as HostParticipant[], [session?.participants])
  const findParticipant = (pid: number | null) => (pid === null ? null : participants.find((p) => p.id === pid) ?? null)

  const invalidateSessionData = () => {
    queryClient.invalidateQueries({ queryKey: ['session', id] })
    queryClient.invalidateQueries({ queryKey: ['report', id] })
  }

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
  const currentDraft = useMemo<CourtDraft>(
    () => courtDrafts[currentCourtName] || EMPTY_DRAFT,
    [courtDrafts, currentCourtName]
  )

  const updateCurrentDraft = (field: keyof CourtDraft, value: string) => {
    setCourtDrafts((prev) => {
      const updated = { ...prev }

      // Proactive cross-court eviction: If player selected, purge from other courts and duplicate slots
      if (value) {
        Object.keys(updated).forEach((cName) => {
          if (cName !== currentCourtName && updated[cName]) {
            const d = { ...updated[cName] }
            let changed = false
            if (d.teamAP1 === value) { d.teamAP1 = ''; changed = true }
            if (d.teamAP2 === value) { d.teamAP2 = ''; changed = true }
            if (d.teamBP1 === value) { d.teamBP1 = ''; changed = true }
            if (d.teamBP2 === value) { d.teamBP2 = ''; changed = true }
            if (changed) updated[cName] = d
          }
        })
      }

      const current = { ...(updated[currentCourtName] || EMPTY_DRAFT) }
      // Avoid duplicate inside same court
      if (value) {
        if (field !== 'teamAP1' && current.teamAP1 === value) current.teamAP1 = ''
        if (field !== 'teamAP2' && current.teamAP2 === value) current.teamAP2 = ''
        if (field !== 'teamBP1' && current.teamBP1 === value) current.teamBP1 = ''
        if (field !== 'teamBP2' && current.teamBP2 === value) current.teamBP2 = ''
      }
      current[field] = value
      updated[currentCourtName] = current

      return updated
    })
  }

  /** Gán nguyên 1 đội hình cho 1 sân, đồng thời rút những người này khỏi các sân khác */
  const assignDraftToCourt = (courtName: string, draft: CourtDraft) => {
    const chosen = new Set([draft.teamAP1, draft.teamAP2, draft.teamBP1, draft.teamBP2].filter(Boolean))
    setCourtDrafts((prev) => {
      const updated = { ...prev }
      Object.keys(updated).forEach((cName) => {
        if (cName !== courtName && updated[cName]) {
          const d = { ...updated[cName] }
          let changed = false
          if (chosen.has(d.teamAP1)) { d.teamAP1 = ''; changed = true }
          if (chosen.has(d.teamAP2)) { d.teamAP2 = ''; changed = true }
          if (chosen.has(d.teamBP1)) { d.teamBP1 = ''; changed = true }
          if (chosen.has(d.teamBP2)) { d.teamBP2 = ''; changed = true }
          if (changed) updated[cName] = d
        }
      })
      updated[courtName] = { ...draft }
      return updated
    })
  }

  // Calculate stats for Fair-Play Sets Distribution in this session (with audit logs of courts)
  const playerStatsMap = useMemo(() => {
    const stats: Record<string, PlayerSetStats> = {}

    // Initialize all roster players with 0 sets
    participants.forEach((p) => {
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

      const recordPlayer = (uid: string, isWinner: boolean) => {
        if (!stats[uid]) {
          stats[uid] = { totalSets: 0, wins: 0, losses: 0, courtHistory: [] }
        }
        stats[uid].totalSets += 1
        stats[uid].courtHistory.push(courtUsed)
        stats[uid].lastCourt = courtUsed
        if (isWinner) stats[uid].wins += 1
        else stats[uid].losses += 1
      }

      recordPlayer(pA1, teamAWon)
      if (pA2) recordPlayer(pA2, teamAWon)
      recordPlayer(pB1, !teamAWon)
      if (pB2) recordPlayer(pB2, !teamAWon)
    })

    return stats
  }, [participants, matches])

  // Người chưa thanh toán lên đầu, người đã thanh toán xuống cuối
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      const aPaid = a.paymentStatus === 'PAID'
      const bPaid = b.paymentStatus === 'PAID'
      if (aPaid !== bPaid) return aPaid ? 1 : -1
      return a.id - b.id
    })
  }, [participants])

  const rosterCounts = useMemo(
    () => ({
      ALL: participants.length,
      NOT_ARRIVED: participants.filter(isNotArrived).length,
      UNPAID: participants.filter(isUnpaid).length,
    }),
    [participants]
  )

  const visibleParticipants = useMemo(() => {
    if (rosterFilter === 'NOT_ARRIVED') return sortedParticipants.filter(isNotArrived)
    if (rosterFilter === 'UNPAID') return sortedParticipants.filter(isUnpaid)
    return sortedParticipants
  }, [sortedParticipants, rosterFilter])

  // Fixed minimum target sets per player (Standard 6 sets per player for a regular badminton session)
  const minTargetSets = 6

  // ===== Mutations theo từng người chơi =====

  // Điểm danh thủ công: cập nhật giao diện ngay, lỗi thì trả lại trạng thái cũ
  const manualCheckinMutation = useMutation({
    mutationFn: async (participantId: number) => {
      const res = await api.post(`/sessions/participants/${participantId}/manual-checkin`)
      return res.data
    },
    onMutate: async (participantId: number) => {
      setRowPending(participantId, true)
      await queryClient.cancelQueries({ queryKey: ['session', id] })
      const prev = queryClient.getQueryData<SessionItem>(['session', id])
      const prevStatus = prev?.participants?.find((p) => p.id === participantId)?.checkinStatus
      if (prev && prevStatus && prevStatus !== 'CHECKED_IN') {
        queryClient.setQueryData<SessionItem>(
          ['session', id],
          patchParticipantInSession(prev, participantId, { checkinStatus: 'CHECKED_IN' }, 1)
        )
      }
      return { prevStatus }
    },
    onError: (err: any, participantId, context) => {
      const prevStatus = context?.prevStatus
      if (prevStatus && prevStatus !== 'CHECKED_IN') {
        const current = queryClient.getQueryData<SessionItem>(['session', id])
        if (current) {
          queryClient.setQueryData<SessionItem>(
            ['session', id],
            patchParticipantInSession(current, participantId, { checkinStatus: prevStatus }, -1)
          )
        }
      }
      showToast(getErrorMessage(err, 'Không thể duyệt điểm danh!'), 'error')
    },
    onSettled: (_data, _err, participantId) => {
      setRowPending(participantId, false)
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      queryClient.invalidateQueries({ queryKey: ['pending-handovers'] })
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboards'] })
    },
  })

  // Cancel Checkin Mutation (Host bấm nhầm duyệt điểm danh)
  const cancelCheckinMutation = useMutation({
    mutationFn: async (participantId: number) => {
      const res = await api.post(`/sessions/participants/${participantId}/cancel-checkin`)
      return res.data as { notes?: string[] }
    },
    onMutate: (participantId: number) => setRowPending(participantId, true),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      queryClient.invalidateQueries({ queryKey: ['pending-handovers'] })
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboards'] })
      const notes = data?.notes ?? []
      showToast(
        notes.length > 0 ? `Đã hủy điểm danh. ${notes.join(' ')}` : 'Đã hủy điểm danh thành công!',
        notes.some((n) => n.includes('giữ nguyên')) ? 'info' : 'success'
      )
    },
    onError: (err: any) => {
      showToast(getErrorMessage(err, 'Không thể hủy điểm danh!'), 'error')
    },
    onSettled: (_data, _err, participantId) => {
      setRowPending(participantId, false)
      setConfirmCancelCheckinId((cur) => (cur === participantId ? null : cur))
    },
  })

  // Confirm Deposit Mutation
  const confirmDepositMutation = useMutation({
    mutationFn: async (participantId: number) => {
      const res = await api.post(`/sessions/participants/${participantId}/confirm-deposit`)
      return res.data
    },
    onMutate: (participantId: number) => setRowPending(participantId, true),
    onSuccess: () => {
      invalidateSessionData()
      showToast('Đã xác nhận nhận tiền cọc!', 'success')
    },
    onError: (err: any) => {
      showToast(getErrorMessage(err, 'Không thể xác nhận tiền cọc!'), 'error')
    },
    onSettled: (_data, _err, participantId) => {
      setRowPending(participantId, false)
      setMenuParticipantId((cur) => (cur === participantId ? null : cur))
    },
  })

  // Override Bill Mutation
  const overrideBillMutation = useMutation({
    mutationFn: async (payload: OverrideBillPayload) => {
      const res = await api.post('/sessions/participants/override-bill', payload)
      return res.data
    },
    onMutate: (payload: OverrideBillPayload) => setRowPending(payload.participantId, true),
    onSuccess: () => {
      setEditingBillId(null)
      invalidateSessionData()
      showToast('Đã cập nhật hóa đơn!', 'success')
    },
    onError: (err: any) => {
      showToast(getErrorMessage(err, 'Không thể sửa hóa đơn!'), 'error')
    },
    onSettled: (_data, _err, payload) => setRowPending(payload.participantId, false),
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
    onMutate: (vars) => setRowPending(vars.participantId, true),
    onSuccess: (_, vars) => {
      setSettlingId((cur) => (cur === vars.participantId ? null : cur))
      invalidateSessionData()
      showToast(
        vars.method === 'CASH'
          ? 'Đã xác nhận thu tiền mặt thành công!'
          : 'Đã xác nhận thu tiền qua VietQR thành công!',
        'success'
      )
    },
    onError: (err: any) => {
      // VD: "Lượt này đã thanh toán rồi!" → làm mới để thấy trạng thái đúng
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      showToast(getErrorMessage(err, 'Không thể cập nhật quyết toán!'), 'error')
    },
    onSettled: (_data, _err, vars) => setRowPending(vars.participantId, false),
  })

  // Hoàn tác thu tiền (Host, trong 7 ngày sau khi ca kết thúc, bắt buộc lý do)
  const undoPaymentMutation = useMutation({
    mutationFn: async ({ participantId, reason }: { participantId: number; reason: string }) => {
      const res = await api.post(`/sessions/participants/${participantId}/undo-payment`, { reason })
      return res.data as HostParticipant
    },
    onMutate: (vars) => setRowPending(vars.participantId, true),
    onSuccess: (_data, vars) => {
      setUndoPaymentId((cur) => (cur === vars.participantId ? null : cur))
      invalidateSessionData()
      const p = findParticipant(vars.participantId)
      showToast(`Đã hoàn tác thu tiền${p ? ` của ${participantDisplayName(p)}` : ''}!`, 'success')
    },
    onError: (err: any) => {
      showToast(getErrorMessage(err, 'Không thể hoàn tác thu tiền!'), 'error')
    },
    onSettled: (_data, _err, vars) => setRowPending(vars.participantId, false),
  })

  // Remove / Cancel Participant Mutation
  const removeParticipantMutation = useMutation({
    mutationFn: async ({ participantId, forfeitDeposit }: { participantId: number; forfeitDeposit: boolean }) => {
      const res = await api.delete(`/sessions/participants/${participantId}?forfeitDeposit=${forfeitDeposit}`)
      return res.data
    },
    onMutate: (vars) => setRowPending(vars.participantId, true),
    onSuccess: (data: any) => {
      invalidateSessionData()
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      showToast(data?.message || 'Đã xử lý thành công!')
    },
    onError: (err: any) => {
      showToast(getErrorMessage(err, 'Không thể xóa người tham gia!'), 'error')
    },
    onSettled: (_data, _err, vars) => {
      setRowPending(vars.participantId, false)
      setConfirmRemoveId((cur) => (cur === vars.participantId ? null : cur))
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
      queryClient.invalidateQueries({ queryKey: ['report', id] })
    },
    onError: (err: any) => {
      showToast(getErrorMessage(err, 'Không thể cập nhật danh sách sân!'), 'error')
    },
  })

  // Hủy ca (Host): lượt chưa thanh toán bị hủy, cọc đã nhận chuyển "Đã hoàn cọc" (Host tự hoàn tiền)
  const cancelSessionMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await api.post(`/sessions/${id}/cancel`, reason ? { reason } : {})
      return res.data as SessionItem
    },
    onMutate: () => setCancelSessionError(''),
    onSuccess: (data) => {
      if (data && typeof data === 'object' && 'id' in data) {
        queryClient.setQueryData<SessionItem>(['session', id], (prev) => ({ ...prev, ...data }))
      }
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      setShowCancelSession(false)
      setCancelReason('')
      showToast('Đã hủy ca. Nhớ hoàn lại tiền cọc đã nhận cho khách nhé!', 'success')
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err, 'Không thể hủy ca!')
      setCancelSessionError(msg)
      showToast(msg, 'error')
    },
  })

  const nextCourtName = () => {
    const existingNums = courtList
      .map((c) => {
        const m = c.match(/(\d+)/)
        return m ? parseInt(m[1], 10) : 0
      })
      .filter((n) => n > 0)
    let nextNum = 1
    while (existingNums.includes(nextNum)) nextNum++
    return `Sân ${nextNum}`
  }

  const handleAddCourt = () => {
    if (!session) return
    const newCourt = newCourtNameInput.trim() || nextCourtName()

    if (courtList.some((c) => c.toLowerCase() === newCourt.toLowerCase())) {
      showToast(`Tên [${newCourt}] đã tồn tại trong ca!`, 'error')
      return
    }

    const newCourtCount = courtList.length + 1
    const newMaxSlots = suggestMaxSlots(newCourtCount, session.bookedSlots)
    const updatedList = [...courtList, newCourt].join(', ')
    updateCourtsMutation.mutate(
      { newCourtNames: updatedList, newMaxSlots },
      {
        onSuccess: () => {
          setShowAddCourtModal(false)
          setNewCourtNameInput('')
          showToast(
            newMaxSlots
              ? `Đã mở thêm [${newCourt}] & cập nhật quân số tối đa thành ${newMaxSlots} người!`
              : `Đã mở thêm [${newCourt}], giữ nguyên ${session.maxSlots} slot.`,
            'success'
          )
        },
      }
    )
  }

  const handleConfirmRemoveCourt = () => {
    if (!session || !confirmRemoveCourt) return
    const target = confirmRemoveCourt
    const remainingCourts = courtList.filter((c) => c !== target)
    if (remainingCourts.length === 0) {
      showToast('Phải giữ lại tối thiểu 1 sân để tổ chức ca đánh!', 'error')
      return
    }
    const newMaxSlots = suggestMaxSlots(remainingCourts.length, session.bookedSlots, 8)
    updateCourtsMutation.mutate(
      { newCourtNames: remainingCourts.join(', '), newMaxSlots },
      {
        onSuccess: () => {
          setConfirmRemoveCourt(null)
          setActiveCourtIndex(0)
          showToast(
            newMaxSlots
              ? `Đã xóa [${target}] & giảm về ${newMaxSlots} slots!`
              : `Đã xóa [${target}], giữ nguyên ${session.maxSlots} slot vì đã có ${session.bookedSlots} người đăng ký.`,
            'info'
          )
        },
      }
    )
  }

  // Record Match Result Mutation
  const recordMatchMutation = useMutation({
    mutationFn: async ({ winningTeam, court, draft }: { winningTeam: 'A' | 'B'; court: string; draft: CourtDraft }) => {
      const res = await api.post('/matches', {
        sessionId: Number(id),
        teamAPlayer1Id: Number(draft.teamAP1),
        teamAPlayer2Id: draft.teamAP2 ? Number(draft.teamAP2) : null,
        teamBPlayer1Id: Number(draft.teamBP1),
        teamBPlayer2Id: draft.teamBP2 ? Number(draft.teamBP2) : null,
        winningTeam,
        courtName: court,
      })
      return res.data as Match
    },
    onSuccess: (data, vars) => {
      setCourtDrafts((prev) => ({ ...prev, [vars.court]: { ...EMPTY_DRAFT } }))
      queryClient.invalidateQueries({ queryKey: ['matches', id] })
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['leaderboards'] })
      const winnerLabel = vars.winningTeam === 'A' ? 'Team Blue' : 'Team Red'
      if (data && typeof data.id === 'number') {
        setUndoMatch({
          matchId: data.id,
          court: vars.court,
          draft: vars.draft,
          message: `Đã ghi ${winnerLabel} thắng [${vars.court}]`,
          key: Date.now(),
        })
      } else {
        showToast(`Đã ghi nhận kết quả trận đấu cho [${vars.court}] thành công!`)
      }
    },
    onError: (err: any) => {
      showToast(getErrorMessage(err, 'Không thể ghi nhận trận đấu!'), 'error')
    },
  })

  // Hoàn tác trận vừa ghi (từ thanh "Hoàn tác" 5 giây)
  const undoMatchMutation = useMutation({
    mutationFn: async (info: UndoMatchInfo) => {
      const res = await api.delete(`/matches/${info.matchId}`)
      return res.data
    },
    onSuccess: (_data, info) => {
      setUndoMatch(null)
      // Trả lại đội hình để Host ghi lại cho đúng (nếu sân đó chưa xếp người mới)
      const cur = courtDrafts[info.court]
      if (!cur || !(cur.teamAP1 || cur.teamAP2 || cur.teamBP1 || cur.teamBP2)) {
        assignDraftToCourt(info.court, info.draft)
      }
      queryClient.invalidateQueries({ queryKey: ['matches', id] })
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      showToast('Đã hoàn tác kết quả trận vừa ghi!', 'success')
    },
    onError: (err: any) => {
      setUndoMatch(null)
      showToast(getErrorMessage(err, 'Không thể hoàn tác trận đấu!'), 'error')
    },
  })

  // Update Match Mutation (Edit Players / Switch Winner)
  const updateMatchMutation = useMutation({
    mutationFn: async ({
      matchId,
      ...body
    }: {
      matchId: number
      teamAPlayer1Id: number
      teamAPlayer2Id: number | null
      teamBPlayer1Id: number
      teamBPlayer2Id: number | null
      winningTeam: 'A' | 'B'
      courtName: string
    }) => {
      const res = await api.put(`/matches/${matchId}`, body)
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
      showToast(getErrorMessage(err, 'Không thể cập nhật trận đấu!'), 'error')
    },
  })

  // Delete Match Mutation (Xóa trận từ popup sửa trận)
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
      showToast(getErrorMessage(err, 'Không thể xóa trận đấu!'), 'error')
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

  const rosterUsers = useMemo(() => participants.filter((p) => p.checkinStatus !== 'ABSENT'), [participants])

  // Helper to get available users for a specific court dropdown (Excludes players assigned in this court AND all other parallel courts)
  const getAvailableUsersForCourt = (courtName: string, currentSelection: string) => {
    const selectedEverywhere = new Set<string>()

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
      .filter((u) => !selectedEverywhere.has(String(u.userId || u.id)))
      .sort((a, b) => {
        const statsA = playerStatsMap[String(a.userId || a.id)]?.totalSets || 0
        const statsB = playerStatsMap[String(b.userId || b.id)]?.totalSets || 0
        if (statsA !== statsB) return statsA - statsB
        return (a.eloScore || 0) - (b.eloScore || 0)
      })
  }

  // Auto Fair-Play Match Suggestion for the current court (Gender-Balanced Double/Single)
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

    const uid = (u: Participant) => String(u.userId || u.id)
    const males = pool.filter((u) => u.gender !== 'FEMALE')
    const females = pool.filter((u) => u.gender === 'FEMALE')

    let p1 = ''
    let p2 = ''
    let p3 = ''
    let p4 = ''

    // Priority 1: Men's Doubles (Nam-Nam vs Nam-Nam) if at least 4 males
    if (males.length >= 4 && (females.length < 2 || males[0] === pool[0])) {
      p1 = uid(males[0]); p2 = uid(males[3]); p3 = uid(males[1]); p4 = uid(males[2])
    }
    // Priority 2: Mixed Doubles (Nam-Nữ vs Nam-Nữ) if at least 2 males & 2 females
    else if (males.length >= 2 && females.length >= 2) {
      p1 = uid(males[0]); p2 = uid(females[0]); p3 = uid(males[1]); p4 = uid(females[1])
    }
    // Priority 3: Women's Doubles (Nữ-Nữ vs Nữ-Nữ) if at least 4 females
    else if (females.length >= 4) {
      p1 = uid(females[0]); p2 = uid(females[3]); p3 = uid(females[1]); p4 = uid(females[2])
    }
    // Priority 4: Men's Doubles fallback if 4 males available
    else if (males.length >= 4) {
      p1 = uid(males[0]); p2 = uid(males[3]); p3 = uid(males[1]); p4 = uid(males[2])
    }
    // Priority 5: Single Match with same gender if possible
    else if (males.length >= 2) {
      p1 = uid(males[0]); p3 = uid(males[1])
    } else if (females.length >= 2) {
      p1 = uid(females[0]); p3 = uid(females[1])
    }
    // Fallback: 4 players general double (or 2 players single) if unbalanced pool
    else if (pool.length >= 4) {
      p1 = uid(pool[0]); p2 = uid(pool[3]); p3 = uid(pool[1]); p4 = uid(pool[2])
    } else {
      p1 = uid(pool[0]); p3 = uid(pool[1])
    }

    assignDraftToCourt(courtName, { teamAP1: p1, teamAP2: p2, teamBP1: p3, teamBP2: p4 })
  }

  // Hành động từ thẻ / menu "⋯"
  const openEditBill = (p: HostParticipant) => {
    const block = editBillBlockReason(p)
    if (block) {
      showToast(block, 'error')
      return
    }
    setMenuParticipantId(null)
    setEditingBillId(p.id)
  }

  const openRemove = (p: HostParticipant) => {
    const block = removeBlockReason(p)
    if (block) {
      showToast(block, 'error')
      return
    }
    setMenuParticipantId(null)
    setConfirmRemoveId(p.id)
  }

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['session', id] })
    queryClient.invalidateQueries({ queryKey: ['matches', id] })
    queryClient.invalidateQueries({ queryKey: ['report', id] })
  }

  if (isError && !session) {
    const notFound = (sessionError as any)?.response?.status === 404
    return (
      <div className="max-w-md mx-auto py-16">
        <div role="alert" className="saas-card rounded-3xl p-6 sm:p-8 text-center space-y-4 border border-slate-200">
          <DuckMascot size={56} rounded="2xl" className="mx-auto opacity-80" />
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-950">
              {notFound ? 'Không tìm thấy ca đánh' : 'Không tải được dữ liệu ca đánh'}
            </h2>
            <p className="text-sm text-slate-600">
              {notFound
                ? 'Ca đánh này không tồn tại hoặc đã bị xóa.'
                : getErrorMessage(sessionError, 'Vui lòng kiểm tra kết nối mạng và thử lại.')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {!notFound && (
              <button
                type="button"
                onClick={() => refetchSession()}
                disabled={sessionFetching}
                className="min-h-11 px-5 rounded-xl bg-slate-950 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} className={sessionFetching ? 'animate-spin' : ''} aria-hidden="true" />
                <span>{sessionFetching ? 'Đang thử lại...' : 'Thử lại'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/host')}
              className="min-h-11 px-5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold"
            >
              Về trang tổng quan Host
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading || !session) {
    return (
      <div className="text-center py-24 text-slate-600 text-sm animate-pulse space-y-3">
        <DuckMascot size={56} rounded="2xl" className="mx-auto" />
        <p className="font-semibold">Đang tải trung tâm điều khiển Host...</p>
      </div>
    )
  }

  const sessionStatus = getEffectiveSessionStatus(session)
  const sessionCancelled = sessionStatus === 'CANCELLED'
  const canCancelSession = !isSessionClosed(sessionStatus)

  const menuParticipant = findParticipant(menuParticipantId)
  const editingBillParticipant = findParticipant(editingBillId)
  const settlingParticipant = findParticipant(settlingId)
  const undoPaymentParticipant = findParticipant(undoPaymentId)
  const cancelCheckinParticipant = findParticipant(confirmCancelCheckinId)
  const removeParticipant = findParticipant(confirmRemoveId)

  const formatClock = (s: string) => formatVnTime(s)

  const tabButtonClass = (active: boolean) =>
    `flex-1 sm:flex-initial min-h-11 px-3 sm:px-3.5 rounded-xl transition flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
      active ? 'bg-slate-950 text-white shadow-md' : 'text-slate-700 hover:text-slate-950'
    }`

  const filterChips: { key: RosterFilter; label: string }[] = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'NOT_ARRIVED', label: 'Chưa đến' },
    { key: 'UNPAID', label: 'Chưa trả tiền' },
  ]

  const removeDepositChoice =
    !!removeParticipant && removeParticipant.isGuest && removeParticipant.depositStatus === 'PAID'
  const removePending = !!removeParticipant && isRowPending(removeParticipant.id)

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <button
          onClick={() => navigate('/')}
          className="min-h-11 sm:min-h-0 flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-sm w-fit"
        >
          <ArrowLeft size={15} />
          <span className="hidden sm:inline">Quay lại trang chủ</span>
          <span className="sm:hidden">Trang chủ</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={refreshAll}
            className="min-h-11 sm:min-h-0 flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <RefreshCw size={13} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={() => navigate(`/sessions/${id}`)}
            className="hidden sm:inline-flex px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition border border-slate-200"
          >
            Xem giao diện thành viên
          </button>
        </div>
      </div>

      {/* Host Command Center Banner (thu gọn trên mobile) */}
      <div className="saas-card rounded-3xl p-4 sm:p-8 space-y-4 sm:space-y-6 relative overflow-hidden">
        {sessionCancelled && (
          <div
            role="alert"
            className="relative z-10 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm sm:text-xs font-bold"
          >
            Ca này đã bị hủy. Đăng ký đã đóng; cọc đã nhận được đánh dấu "Đã hoàn cọc" — Host vui lòng hoàn tiền cho khách.
          </div>
        )}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 relative z-10">
          <div className="space-y-3 sm:space-y-4 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden sm:flex text-[11px] font-black uppercase tracking-wider px-3 py-1 bg-slate-900 text-white rounded-full items-center gap-1.5 shadow-xs">
                <Shield size={13} className="text-rose-400" />
                <span>Host Control Center</span>
              </span>

              <span
                data-testid="host-session-status"
                className={`text-[11px] font-black uppercase px-3 py-1 rounded-full border ${
                  sessionCancelled
                    ? 'bg-rose-600 text-white border-rose-600'
                    : sessionStatus === 'ACTIVE'
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {SESSION_STATUS_LABEL[sessionStatus]}
              </span>

              <button
                onClick={() => setShowCourtEditModal(true)}
                className="min-h-9 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 shadow-2xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                aria-label="Cài đặt sân và số slot"
              >
                <span>🏸 {courtList.join(', ')} ({courtList.length} Sân)</span>
                <Edit2 size={11} className="text-slate-500" />
              </button>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-3xl font-black text-slate-950 tracking-tight leading-snug">{session.title}</h1>

              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                  📍 <b>{session.venueName}</b>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                  ⏰ {formatClock(session.startTime)} - {formatClock(session.endTime)}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-bold">
                  🎯 Tối thiểu {minTargetSets} set/người
                </span>
              </div>
            </div>

            {/* Tóm tắt nhanh + nút mở rộng (chỉ mobile) */}
            <div className="md:hidden flex items-center gap-2">
              <div className="flex-1 min-w-0 text-xs font-bold text-slate-700 leading-snug">
                👥 {session.bookedSlots}/{session.maxSlots} · ✅ {session.checkedInSlots} đã đến · 💰{' '}
                {formatVnd(report?.totalRevenue)}
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl bg-slate-950 text-white shadow"
                aria-label="Mở mã QR điểm danh"
              >
                <QrCode size={18} />
              </button>
              <button
                type="button"
                onClick={() => setShowSessionDetails((v) => !v)}
                aria-expanded={showSessionDetails}
                aria-controls="host-session-details"
                className="min-h-11 px-3 inline-flex items-center gap-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold"
              >
                <span>Chi tiết ca</span>
                <ChevronDown size={14} className={`transition-transform ${showSessionDetails ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Dynamic Token Quick Box */}
          <div
            className={`${showSessionDetails ? 'flex' : 'hidden'} md:flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm shrink-0`}
          >
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="w-16 h-16 bg-white p-1.5 rounded-xl flex items-center justify-center cursor-pointer shadow border border-slate-200 hover:scale-105 transition shrink-0"
              aria-label="Phóng to QR cho thành viên quét"
            >
              <QRCodeSVG value={checkinDirectUrl || session.checkinToken || 'NONE'} size={56} />
            </button>

            <div className="min-w-0">
              <span className="text-[11px] text-slate-500 block font-bold">Mã điểm danh:</span>
              <span className="text-2xl font-mono font-black text-slate-900 tracking-wider">{session.checkinToken}</span>
              <p className="text-[11px] text-slate-500 font-medium leading-snug">
                Thành viên tự điểm danh từ 30 phút trước giờ bắt đầu đến hết ca
              </p>
              <button
                onClick={() => setShowQrModal(true)}
                className="min-h-9 text-[11px] text-slate-900 hover:underline font-bold flex items-center gap-0.5"
              >
                <Maximize2 size={12} />
                <span>Phóng to</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Executive Metrics Dashboard */}
        <div
          id="host-session-details"
          className={`${showSessionDetails ? 'grid' : 'hidden'} md:grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-4 sm:pt-5 border-t border-slate-200 text-xs relative z-10`}
        >
          <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200">
            <span className="text-slate-500 font-bold block text-[11px]">Quân số hiện tại</span>
            <span className="text-lg sm:text-xl font-black text-slate-900 mt-1 block">
              {session.bookedSlots} / {session.maxSlots} Người
            </span>
          </div>
          <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200">
            <span className="text-slate-500 font-bold block text-[11px]">Đã điểm danh tại sân</span>
            <span className="text-lg sm:text-xl font-black text-emerald-700 mt-1 block">{session.checkedInSlots} Đã Đến</span>
          </div>
          <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200">
            <span className="text-slate-500 font-bold block text-[11px]">Doanh thu đã thu</span>
            <span className="text-lg sm:text-xl font-black text-slate-900 mt-1 block">{formatVnd(report?.totalRevenue)}</span>
          </div>
          <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200">
            <span className="text-slate-500 font-bold block text-[11px]">Tổng số trận đã đánh</span>
            <span className="text-lg sm:text-xl font-black text-slate-900 mt-1 block">
              {matches?.length || 0} Trận ({courtList.length} Sân)
            </span>
          </div>
          {canCancelSession && (
            <div className="col-span-2 md:col-span-4 flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setCancelSessionError('')
                  setShowCancelSession(true)
                }}
                className="min-h-11 sm:min-h-9 px-3 inline-flex items-center gap-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-sm sm:text-xs font-bold transition"
              >
                <Trash2 size={13} aria-hidden="true" />
                <span>Hủy ca</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Thanh tab dính dưới header (header Layout cao 4.5rem, cũng sticky) */}
      <div className="sticky top-[4.5rem] z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-2 bg-[#F4F6F9]/95 backdrop-blur-md">
        <div
          role="tablist"
          aria-label="Khu vực điều khiển ca"
          className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl overflow-x-auto no-scrollbar shadow-inner text-xs font-bold touch-pan-x"
        >
          <button role="tab" aria-selected={activeTab === 'roster'} onClick={() => setActiveTab('roster')} className={tabButtonClass(activeTab === 'roster')}>
            <Users size={14} />
            <span>
              <span className="hidden sm:inline">1. </span>Điểm danh ({participants.length})
            </span>
          </button>
          <button role="tab" aria-selected={activeTab === 'matchmaker'} onClick={() => setActiveTab('matchmaker')} className={tabButtonClass(activeTab === 'matchmaker')}>
            <Swords size={14} />
            <span>
              <span className="hidden sm:inline">2. Bắt kèo ({courtList.length} Sân)</span>
              <span className="sm:hidden">Trận đấu</span>
            </span>
          </button>
          <button role="tab" aria-selected={activeTab === 'settle'} onClick={() => setActiveTab('settle')} className={tabButtonClass(activeTab === 'settle')}>
            <DollarSign size={14} />
            <span>
              <span className="hidden sm:inline">3. Quyết toán & MVP</span>
              <span className="sm:hidden">Quyết toán</span>
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: DANH SÁCH ĐIỂM DANH */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Lọc nhanh */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Lọc danh sách">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                aria-pressed={rosterFilter === chip.key}
                onClick={() => setRosterFilter(chip.key)}
                className={`min-h-11 px-4 rounded-full border text-sm sm:text-xs font-bold whitespace-nowrap transition ${
                  rosterFilter === chip.key
                    ? 'bg-slate-950 text-white border-slate-950'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                }`}
              >
                {chip.label} ({rosterCounts[chip.key]})
              </button>
            ))}
          </div>

          {visibleParticipants.length === 0 && (
            <div className="saas-card rounded-2xl p-8 text-center text-sm text-slate-500 font-semibold">
              {participants.length === 0 ? 'Chưa có người đăng ký ca này.' : 'Không có ai trong mục lọc này 🎉'}
            </div>
          )}

          {/* Mobile: thẻ từng người */}
          {visibleParticipants.length > 0 && (
            <div className="md:hidden space-y-3" data-testid="roster-cards">
              {visibleParticipants.map((p, idx) => (
                <RosterCard
                  key={p.id}
                  participant={p}
                  index={idx}
                  stats={playerStatsMap[String(p.userId || p.id)] || EMPTY_STATS}
                  pending={isRowPending(p.id)}
                  onCheckin={(pp) => manualCheckinMutation.mutate(pp.id)}
                  onRequestCancelCheckin={(pp) => setConfirmCancelCheckinId(pp.id)}
                  onSettle={(pp) => setSettlingId(pp.id)}
                  onOpenMenu={(pp) => setMenuParticipantId(pp.id)}
                />
              ))}
            </div>
          )}

          {/* Desktop: bảng */}
          {visibleParticipants.length > 0 && (
            <div className="hidden md:block saas-card rounded-2xl p-6 sm:p-8 space-y-4">
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
                    {visibleParticipants.map((p, idx) => {
                      const isCheckedIn = p.checkinStatus === 'CHECKED_IN'
                      const isPaid = p.paymentStatus === 'PAID'
                      const rowPending = isRowPending(p.id)
                      const name = participantDisplayName(p, idx)
                      const stats = playerStatsMap[String(p.userId || p.id)] || EMPTY_STATS
                      const editBlock = editBillBlockReason(p)
                      const removeBlock = removeBlockReason(p)

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition" aria-busy={rowPending || undefined}>
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
                                <span className="font-bold text-slate-900 block text-sm">{name}</span>
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
                                      ? 'bg-rose-50 text-rose-700 border-rose-300'
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
                                  <span>
                                    Vừa đánh: <b>{stats.lastCourt}</b>
                                  </span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            {isCheckedIn ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {rowPending ? (
                                    <Loader2 size={11} className="animate-spin" />
                                  ) : (
                                    <CheckCircle2 size={11} className="text-emerald-600" />
                                  )}
                                  <span>{rowPending ? 'Đang lưu...' : 'Đã điểm danh'}</span>
                                </span>
                                <button
                                  onClick={() => setConfirmCancelCheckinId(p.id)}
                                  disabled={rowPending}
                                  className="min-h-8 min-w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Hủy điểm danh (dùng khi lỡ bấm duyệt nhầm)"
                                  aria-label={`Hủy điểm danh ${name}`}
                                >
                                  <Undo2 size={13} />
                                </button>
                              </div>
                            ) : p.checkinStatus === 'ABSENT' ? (
                              <span className="text-[10px] text-slate-400 font-semibold">Vắng</span>
                            ) : (
                              <button
                                onClick={() => manualCheckinMutation.mutate(p.id)}
                                disabled={rowPending}
                                className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-800 border border-dashed border-slate-300 hover:border-emerald-400 shadow-2xs hover:shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                title="Duyệt điểm danh thủ công cho người này"
                              >
                                {rowPending ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Square size={13} className="text-slate-400 group-hover:text-emerald-600 transition" />
                                )}
                                <span>{rowPending ? 'Đang lưu...' : 'Chưa đến (Bấm duyệt)'}</span>
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
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {p.depositStatus === 'PAID'
                                  ? 'Đã nhận cọc'
                                  : p.depositStatus === 'FORFEITED'
                                  ? 'Cọc đã vào quỹ'
                                  : p.depositStatus === 'REFUNDED'
                                  ? 'Đã hoàn cọc'
                                  : 'Chờ duyệt cọc'}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3">
                            <span className="text-sm font-black text-slate-950 block tracking-tight whitespace-nowrap">
                              {formatVnd(p.finalFee)}
                            </span>
                            {!isPaid && p.checkinStatus !== 'ABSENT' && (
                              <span className="text-[10px] font-bold text-slate-700 block whitespace-nowrap mt-0.5">
                                Còn thu: {formatVnd(p.remainingAmount)}
                                {p.depositStatus === 'PAID' && Number(p.depositAmount) > 0 && (
                                  <span className="text-emerald-700"> (đã trừ cọc {formatVnd(p.depositAmount)})</span>
                                )}
                              </span>
                            )}
                            {p.slotWindow ? (
                              <span className="text-[10px] text-slate-800 font-bold block whitespace-nowrap bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 rounded-md mt-1">
                                ⏱️ {p.slotWindow}
                              </span>
                            ) : p.durationHours ? (
                              <span className="text-[10px] text-slate-800 font-bold block whitespace-nowrap bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 rounded-md mt-1">
                                ⏱️ Đánh {p.durationHours}h
                              </span>
                            ) : null}
                            {p.adjustmentAmount !== 0 && (
                              <span
                                className={`text-[10px] font-bold block whitespace-nowrap mt-0.5 ${
                                  p.adjustmentAmount < 0 ? 'text-rose-600' : 'text-amber-700'
                                }`}
                              >
                                {p.adjustmentReason ? `🎁 ${p.adjustmentReason}: ` : 'Điều chỉnh: '}
                                {p.adjustmentAmount > 0 ? '+' : ''}
                                {formatVnd(p.adjustmentAmount)}
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
                                ? `Đã thanh toán (${paymentMethodLabel(p.paymentMethod)})`
                                : p.paymentMethod === 'CASH'
                                ? 'Chưa thanh toán (Tiền mặt)'
                                : p.paymentMethod === 'VIETQR'
                                ? 'Chưa thanh toán (Chuyển khoản)'
                                : 'Chưa thanh toán'}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              {canConfirmDeposit(p) && (
                                <button
                                  onClick={() => confirmDepositMutation.mutate(p.id)}
                                  disabled={rowPending}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Xác nhận đã nhận cọc vãng lai"
                                >
                                  {rowPending ? 'Đang xử lý...' : 'Đã nhận cọc'}
                                </button>
                              )}

                              <button
                                onClick={() => openEditBill(p)}
                                disabled={!!editBlock || rowPending}
                                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                title={editBlock ?? 'Điều chỉnh tiền (về sớm, sự cố...)'}
                                aria-label={`Sửa hóa đơn ${name}`}
                              >
                                <Edit2 size={13} />
                              </button>

                              {p.canUndoPayment === true && (
                                <button
                                  onClick={() => setUndoPaymentId(p.id)}
                                  disabled={rowPending}
                                  className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 disabled:opacity-50"
                                  title="Hoàn tác thu tiền (bấm nhầm, sai hình thức...)"
                                >
                                  <RotateCcw size={11} />
                                  <span>Hoàn tác thu</span>
                                </button>
                              )}

                              {!isPaid && p.checkinStatus !== 'ABSENT' && (
                                <button
                                  onClick={() => setSettlingId(p.id)}
                                  disabled={rowPending}
                                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] shadow transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Thu tiền
                                </button>
                              )}

                              {/* Xóa nằm tách riêng, có khoảng cách với nút Thu tiền */}
                              {!isCheckedIn && p.checkinStatus !== 'ABSENT' && (
                                <button
                                  onClick={() => openRemove(p)}
                                  disabled={!!removeBlock || rowPending}
                                  className="ml-2 p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                  title={removeBlock ?? 'Hủy đăng ký / Xóa slot nhường cho người khác'}
                                  aria-label={`Xóa ${name} khỏi ca`}
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
          )}
        </div>
      )}

      {/* TAB 2: GHÉP SÂN & GHI KẾT QUẢ */}
      {activeTab === 'matchmaker' && (
        <div className="space-y-5 sm:space-y-6">
          {/* Chọn sân */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            <span className="hidden sm:flex text-xs font-bold text-slate-500 uppercase tracking-wider items-center gap-1 shrink-0 mr-1">
              <Layers size={14} /> Sân:
            </span>
            {courtList.map((cName, idx) => {
              const draft = courtDrafts[cName]
              const hasDraft = draft && (draft.teamAP1 || draft.teamBP1)
              const isActive = activeCourtIndex === idx
              return (
                <button
                  key={cName}
                  onClick={() => setActiveCourtIndex(idx)}
                  aria-pressed={isActive}
                  className={`min-h-11 px-3.5 rounded-xl text-sm sm:text-xs font-black transition flex items-center gap-1.5 shrink-0 border ${
                    isActive
                      ? 'bg-slate-950 text-white border-slate-950 shadow-md'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 shadow-2xs'
                  }`}
                >
                  <span>🏸 {cName}</span>
                  {hasDraft && <span className="w-2 h-2 rounded-full bg-rose-500" aria-label="Đang xếp cặp" />}
                </button>
              )
            })}

            <button
              onClick={() => {
                setNewCourtNameInput(nextCourtName())
                setShowAddCourtModal(true)
              }}
              className="min-h-11 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-sm sm:text-xs font-black transition flex items-center gap-1 shrink-0 shadow-2xs active:scale-95"
              title="Mở thêm sân song song cho ca đấu này"
            >
              <Plus size={14} className="text-emerald-700" />
              <span>Thêm sân</span>
            </button>

            <button
              onClick={() => setShowCourtEditModal(true)}
              className="min-h-11 min-w-11 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shrink-0"
              aria-label="Cài đặt sân"
              title="Đổi tên sân, số slot hoặc xóa sân"
            >
              <Settings2 size={16} />
              <span className="hidden sm:inline">Cài đặt sân</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8">
            {/* Ghép người + ghi kết quả */}
            <div className="lg:col-span-7 space-y-4">
              <div className="saas-card rounded-3xl p-4 sm:p-8 space-y-5 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Swords size={18} className="text-slate-950" />
                    <span>Sàn đấu: {currentCourtName}</span>
                  </h2>
                  <button
                    onClick={() => handleAutoSuggestFairMatch(currentCourtName)}
                    className="min-h-11 px-3.5 bg-slate-950 hover:bg-slate-900 text-white font-black rounded-xl text-sm sm:text-xs shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0"
                  >
                    <Sparkles size={14} className="text-amber-400" />
                    <span>Ghép kèo công bằng</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {/* TEAM BLUE */}
                  <div className="bg-blue-50/40 rounded-2xl p-3.5 sm:p-5 border border-blue-200/80 space-y-3 sm:space-y-4 shadow-xs relative">
                    <div className="flex items-center gap-2 pb-2 border-b border-blue-200/60">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs" />
                      <span className="font-black text-xs text-blue-700 tracking-wider uppercase">TEAM BLUE</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[11px] font-bold text-slate-700">Player 1</span>
                      <PlayerSelect
                        value={currentDraft.teamAP1}
                        onChange={(val) => updateCurrentDraft('teamAP1', val)}
                        options={getAvailableUsersForCourt(currentCourtName, currentDraft.teamAP1)}
                        playerStatsMap={playerStatsMap}
                        placeholder="Chọn tay vợt..."
                        colorTheme="blue"
                        allowClear={true}
                        ariaLabel="Team Blue - Player 1"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[11px] font-bold text-slate-700">Player 2 (Đánh đôi)</span>
                      <PlayerSelect
                        value={currentDraft.teamAP2}
                        onChange={(val) => updateCurrentDraft('teamAP2', val)}
                        options={getAvailableUsersForCourt(currentCourtName, currentDraft.teamAP2)}
                        playerStatsMap={playerStatsMap}
                        placeholder="(Không có - Đánh đơn)"
                        colorTheme="blue"
                        allowClear={true}
                        ariaLabel="Team Blue - Player 2"
                      />
                    </div>
                  </div>

                  {/* TEAM RED */}
                  <div className="bg-rose-50/40 rounded-2xl p-3.5 sm:p-5 border border-rose-200/80 space-y-3 sm:space-y-4 shadow-xs relative">
                    <div className="flex items-center gap-2 pb-2 border-b border-rose-200/60">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shadow-xs" />
                      <span className="font-black text-xs text-rose-700 tracking-wider uppercase">TEAM RED</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[11px] font-bold text-slate-700">Player 1</span>
                      <PlayerSelect
                        value={currentDraft.teamBP1}
                        onChange={(val) => updateCurrentDraft('teamBP1', val)}
                        options={getAvailableUsersForCourt(currentCourtName, currentDraft.teamBP1)}
                        playerStatsMap={playerStatsMap}
                        placeholder="Chọn tay vợt..."
                        colorTheme="rose"
                        allowClear={true}
                        ariaLabel="Team Red - Player 1"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[11px] font-bold text-slate-700">Player 2 (Đánh đôi)</span>
                      <PlayerSelect
                        value={currentDraft.teamBP2}
                        onChange={(val) => updateCurrentDraft('teamBP2', val)}
                        options={getAvailableUsersForCourt(currentCourtName, currentDraft.teamBP2)}
                        playerStatsMap={playerStatsMap}
                        placeholder="(Không có - Đánh đơn)"
                        colorTheme="rose"
                        allowClear={true}
                        ariaLabel="Team Red - Player 2"
                      />
                    </div>
                  </div>
                </div>

                {/* Ghi kết quả 1 chạm (có Hoàn tác 5 giây) */}
                <div className="space-y-2.5 pt-1">
                  <p className="text-xs font-bold text-slate-600 px-1">Đội thắng trên [{currentCourtName}]:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      disabled={!currentDraft.teamAP1 || !currentDraft.teamBP1 || recordMatchMutation.isPending}
                      onClick={() =>
                        recordMatchMutation.mutate({ winningTeam: 'A', court: currentCourtName, draft: currentDraft })
                      }
                      className="min-h-14 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black rounded-2xl text-sm shadow-md shadow-blue-500/20 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                      <span className="w-2 h-2 rounded-full bg-white" />
                      <span>Team Blue thắng</span>
                    </button>
                    <button
                      disabled={!currentDraft.teamAP1 || !currentDraft.teamBP1 || recordMatchMutation.isPending}
                      onClick={() =>
                        recordMatchMutation.mutate({ winningTeam: 'B', court: currentCourtName, draft: currentDraft })
                      }
                      className="min-h-14 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-black rounded-2xl text-sm shadow-md shadow-rose-500/20 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                      <span className="w-2 h-2 rounded-full bg-white" />
                      <span>Team Red thắng</span>
                    </button>
                  </div>
                  {recordMatchMutation.isPending && (
                    <p className="text-xs text-slate-500 font-semibold text-center">Đang ghi kết quả...</p>
                  )}
                </div>
              </div>
            </div>

            {/* Lịch sử trận (không cuộn lồng trên mobile) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="saas-card rounded-3xl p-4 sm:p-8 space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center justify-between pb-3.5 border-b border-slate-200">
                  <span>Lịch sử trận theo Sân</span>
                  <span className="text-xs text-slate-500 font-medium">{matches?.length || 0} trận</span>
                </h3>

                <div className="space-y-2.5 md:max-h-[520px] md:overflow-y-auto md:pr-1">
                  {!matches || matches.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">Chưa có trận nào được ghi nhận</div>
                  ) : (
                    matches.map((m) => (
                      <div
                        key={m.id}
                        className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-2 hover:border-slate-300 transition shadow-sm text-xs"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <span className="font-bold px-2.5 py-0.5 bg-slate-100 text-slate-900 rounded-md text-[11px] border border-slate-200">
                            🏸 {m.courtName || 'Sân chính'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 font-mono">{formatMatchTime(m.createdAt)}</span>
                            <button
                              onClick={() => openEditMatchModal(m)}
                              className="min-h-11 px-3 bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-slate-200 hover:border-slate-900 active:scale-95"
                              title="Sửa trận đấu: Đổi đội thắng, đổi người chơi hoặc xóa trận"
                            >
                              <Edit2 size={12} />
                              <span>Sửa</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className={`font-bold flex items-center justify-between gap-2 ${m.winningTeam === 'A' ? 'text-slate-950' : 'text-slate-400'}`}>
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                              <span>
                                {m.teamAPlayer1Name} {m.teamAPlayer2Name && `+ ${m.teamAPlayer2Name}`}
                              </span>
                            </span>
                            {m.winningTeam === 'A' && (
                              <span className="text-[10px] bg-cyan-50 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-md font-black shrink-0">
                                👑 THẮNG
                              </span>
                            )}
                          </div>
                          <div className={`font-bold flex items-center justify-between gap-2 ${m.winningTeam === 'B' ? 'text-slate-950' : 'text-slate-400'}`}>
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                              <span>
                                {m.teamBPlayer1Name} {m.teamBPlayer2Name && `+ ${m.teamBPlayer2Name}`}
                              </span>
                            </span>
                            {m.winningTeam === 'B' && (
                              <span className="text-[10px] bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-black shrink-0">
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

          {/* Bảng số set từng người (thu gọn trên mobile) */}
          <div className="saas-card rounded-2xl p-4 sm:p-6 space-y-4 border border-slate-200/90 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-slate-900 shrink-0" />
                <div>
                  <h3 className="text-sm font-black text-slate-900">Số set từng người (mục tiêu {minTargetSets} set/người)</h3>
                  <p className="hidden sm:block text-[11px] text-slate-500 font-medium">
                    Theo dõi số set đã đánh và sân vừa đánh của từng thành viên
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSetsGrid((v) => !v)}
                aria-expanded={showSetsGrid}
                aria-controls="host-sets-grid"
                className="md:hidden min-h-11 px-3 inline-flex items-center justify-center gap-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-sm font-bold"
              >
                <span>{showSetsGrid ? 'Thu gọn' : `Xem số set (${rosterUsers.length} người)`}</span>
                <ChevronDown size={14} className={`transition-transform ${showSetsGrid ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div
              id="host-sets-grid"
              className={`${showSetsGrid ? 'grid' : 'hidden'} md:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3`}
            >
              {rosterUsers
                .map((u) => ({
                  ...u,
                  stats: playerStatsMap[String(u.userId || u.id)] || EMPTY_STATS,
                  rank: getLolRank(u.eloScore || 0),
                }))
                .sort((a, b) => a.stats.totalSets - b.stats.totalSets)
                .map((u) => {
                  const isLow = u.stats.totalSets <= 1
                  const isEnough = u.stats.totalSets >= minTargetSets
                  return (
                    <div
                      key={u.id}
                      className={`p-3 rounded-2xl border transition relative overflow-hidden ${
                        isLow
                          ? 'bg-rose-50/70 border-rose-300'
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
                            <span className="font-bold text-slate-900 text-xs truncate block">{u.name}</span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                                isLow ? 'bg-rose-600 text-white' : isEnough ? 'bg-emerald-700 text-white' : 'bg-slate-900 text-white'
                              }`}
                            >
                              {u.stats.totalSets} set
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                            <span className="font-semibold">
                              {u.rank.badge} ({u.eloScore || 0} LP)
                            </span>
                            <span className="font-mono">
                              {u.stats.wins} Win - {u.stats.losses} Lose
                            </span>
                          </div>
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
        </div>
      )}

      {/* TAB 3: FINANCIAL SETTLEMENT DASHBOARD */}
      {activeTab === 'settle' && report && (
        <div className="space-y-6">
          {report.mvpUserId && report.mvpWins && report.mvpWins > 0 && (
            (() => {
              const mvpParticipant = participants.find(
                (p) => String(p.userId || p.id) === String(report.mvpUserId) || p.name === report.mvpName
              )
              const mvpAvatar = report.mvpAvatarUrl || mvpParticipant?.avatarUrl || '/duck-mascot.png'

              return (
                <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 rounded-3xl p-5 sm:p-7 text-slate-950 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 relative overflow-hidden">
                  <div className="flex items-center gap-3.5 sm:gap-4 relative z-10 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <DuckMascot src={mvpAvatar} size={60} rounded="2xl" className="border-2 border-slate-950/80 shadow-xl" />
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center text-xs shadow-md border border-amber-400">
                        👑
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">
                        <span>Vinh danh MVP Ca Đấu</span>
                      </div>
                      <h3 className="text-lg sm:text-2xl font-black truncate">{report.mvpName}</h3>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">
                        Thắng nhiều nhất: <b>{report.mvpWins} Thắng</b> (-{report.mvpLosses} Thua)
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-yellow-300/80 text-left md:text-right shrink-0 shadow-md relative z-10 md:max-w-xs">
                    <span className="text-[10px] sm:text-[11px] font-black uppercase text-amber-900 block">Phần thưởng MVP Ca Đấu</span>
                    <span className="font-black text-xs sm:text-sm text-slate-950 block mt-0.5">🥤 Tặng 01 Nước giải khát Revive</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-600 block mt-0.5 font-semibold">(Host trao tặng trực tiếp tại sân)</span>
                  </div>
                </div>
              )
            })()
          )}

          <div className="saas-card rounded-3xl p-5 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
                  <Receipt size={18} className="text-slate-950" />
                  <span>Báo cáo Quyết toán Doanh thu & Chi phí Ca</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Báo cáo tài chính minh bạch cho Host</p>
              </div>
              <span className="text-[11px] font-bold px-3 py-1 bg-slate-100 text-slate-800 rounded-xl border border-slate-200 self-start sm:self-auto truncate max-w-xs">
                {session.title}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-3.5 text-xs">
                <span className="font-bold text-slate-900 block text-sm border-b border-slate-200 pb-2">1. Tổng các khoản THU</span>
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
                  <span className="font-bold text-slate-900">{formatVnd(report.totalDepositCollected)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-black text-slate-900">
                  <span>Tổng tiền sân THU ĐƯỢC:</span>
                  <span className="text-emerald-700">{formatVnd(report.totalRevenue)}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-3.5 text-xs">
                <span className="font-bold text-slate-900 block text-sm border-b border-slate-200 pb-2">2. Tổng các khoản CHI & Lợi Nhuận</span>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Tiền thuê sân (Host trả chủ sân):</span>
                  <span className="font-bold text-slate-900">{formatVnd(report.costCourt)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Tiền cầu lông (Ống cầu tiêu hao):</span>
                  <span className="font-bold text-slate-900">{formatVnd(report.costShuttlecock)}</span>
                </div>
                {Number(report.costDrinks || 0) > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tiền trà đá / nước uống:</span>
                    <span className="font-bold text-slate-900">{formatVnd(report.costDrinks)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-600">
                  <span>Tổng chi phí vận hành:</span>
                  <span className="font-bold text-rose-600">{formatVnd(report.totalExpenses)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-black">
                  <span className="text-slate-900">LỢI NHUẬN RÒNG (Net):</span>
                  <span className={`text-base font-black ${report.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {formatVnd(report.netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Popup thao tác người chơi ===== */}
      <ParticipantActionsSheet
        participant={menuParticipant}
        onClose={() => setMenuParticipantId(null)}
        onEditBill={openEditBill}
        onConfirmDeposit={(p) => confirmDepositMutation.mutate(p.id)}
        onCancelCheckin={(p) => {
          setMenuParticipantId(null)
          setConfirmCancelCheckinId(p.id)
        }}
        onUndoPayment={(p) => {
          setMenuParticipantId(null)
          setUndoPaymentId(p.id)
        }}
        onRemove={openRemove}
        depositPending={!!menuParticipant && isRowPending(menuParticipant.id)}
      />

      <OverrideBillSheet
        participant={editingBillParticipant}
        onClose={() => setEditingBillId(null)}
        onSubmit={(payload) => overrideBillMutation.mutate(payload)}
        pending={!!editingBillParticipant && isRowPending(editingBillParticipant.id)}
      />

      <UndoPaymentSheet
        participant={undoPaymentParticipant}
        onClose={() => setUndoPaymentId(null)}
        onSubmit={(reason) => undoPaymentParticipant && undoPaymentMutation.mutate({ participantId: undoPaymentParticipant.id, reason })}
        pending={!!undoPaymentParticipant && isRowPending(undoPaymentParticipant.id)}
      />

      <ConfirmSheet
        open={!!cancelCheckinParticipant}
        onClose={() => setConfirmCancelCheckinId(null)}
        title={`Hủy điểm danh: ${cancelCheckinParticipant ? participantDisplayName(cancelCheckinParticipant) : ''}`}
        confirmLabel="Hủy điểm danh"
        pendingLabel="Đang hủy..."
        cancelLabel="Giữ nguyên"
        destructive
        pending={!!cancelCheckinParticipant && isRowPending(cancelCheckinParticipant.id)}
        onConfirm={() => cancelCheckinParticipant && cancelCheckinMutation.mutate(cancelCheckinParticipant.id)}
      >
        <p>
          Số buổi tham gia sẽ được tính lại và quà chưa trao của mốc không còn đủ điều kiện sẽ bị thu hồi. Chỉ dùng khi lỡ
          bấm nhầm.
        </p>
      </ConfirmSheet>

      {/* Thu tiền (Tiền mặt / VietQR) */}
      <BottomSheet
        open={!!settlingParticipant}
        onClose={() => setSettlingId(null)}
        title="Xác nhận thu tiền sân"
        footer={
          settlingParticipant && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-medium text-center">Chọn hình thức nhận tiền thực tế:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={isRowPending(settlingParticipant.id)}
                  onClick={() => settlePaymentMutation.mutate({ participantId: settlingParticipant.id, method: 'CASH' })}
                  className="min-h-12 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-sm sm:text-xs shadow-md active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {isRowPending(settlingParticipant.id) ? 'Đang lưu...' : '💵 Tiền mặt'}
                </button>
                <button
                  disabled={isRowPending(settlingParticipant.id)}
                  onClick={() => settlePaymentMutation.mutate({ participantId: settlingParticipant.id, method: 'VIETQR' })}
                  className="min-h-12 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-sm sm:text-xs shadow-md active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {isRowPending(settlingParticipant.id) ? 'Đang lưu...' : '⚡ VietQR'}
                </button>
              </div>
            </div>
          )
        }
      >
        {settlingParticipant && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-sm sm:text-xs">
            <div className="flex justify-between items-center gap-3 text-slate-600">
              <span>Người chơi:</span>
              <span className="font-bold text-slate-900 text-right">{participantDisplayName(settlingParticipant)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Số điện thoại:</span>
              <span className="font-mono text-slate-700">{settlingParticipant.phone}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Loại khách:</span>
              <span className="font-bold text-slate-800">{settlingParticipant.isGuest ? 'Khách Vãng lai' : 'Thành viên CLB'}</span>
            </div>
            {settlingParticipant.paymentMethod && (
              <div className="flex justify-between items-center text-slate-600">
                <span>Khách chọn trước:</span>
                <span className="font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md text-xs">
                  {settlingParticipant.paymentMethod === 'CASH' ? '💵 Tiền mặt' : '⚡ Chuyển khoản VietQR'}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-slate-600">
              <span>Hóa đơn:</span>
              <span className="font-bold text-slate-900">{formatVnd(settlingParticipant.finalFee)}</span>
            </div>
            {settlingParticipant.depositStatus === 'PAID' && Number(settlingParticipant.depositAmount) > 0 && (
              <div className="flex justify-between items-center text-emerald-700 font-semibold">
                <span>Trừ cọc đã nhận:</span>
                <span>- {formatVnd(settlingParticipant.depositAmount)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900">
              <span>Số tiền cần thu:</span>
              <span className="text-lg font-black text-emerald-700 font-mono">{formatVnd(settlingParticipant.remainingAmount)}</span>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Xóa / Hủy slot người chơi */}
      <BottomSheet
        open={!!removeParticipant}
        onClose={() => !removePending && setConfirmRemoveId(null)}
        closeOnBackdrop={!removePending}
        title={`Hủy lượt đăng ký: ${removeParticipant ? participantDisplayName(removeParticipant) : ''}`}
        footer={
          removeParticipant &&
          (removeDepositChoice ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={removePending}
                  onClick={() => removeParticipantMutation.mutate({ participantId: removeParticipant.id, forfeitDeposit: true })}
                  className="min-h-11 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-sm sm:text-xs shadow-sm transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {removePending ? 'Đang xóa...' : 'Giữ cọc vào quỹ'}
                </button>
                <button
                  disabled={removePending}
                  onClick={() => removeParticipantMutation.mutate({ participantId: removeParticipant.id, forfeitDeposit: false })}
                  className="min-h-11 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-sm sm:text-xs transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {removePending ? 'Đang xóa...' : 'Hoàn cọc & Hủy'}
                </button>
              </div>
              <button
                disabled={removePending}
                onClick={() => setConfirmRemoveId(null)}
                className="w-full min-h-11 text-slate-600 font-bold text-sm sm:text-xs rounded-xl hover:bg-slate-100 disabled:opacity-50"
              >
                Không hủy
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={removePending}
                onClick={() => setConfirmRemoveId(null)}
                className="min-h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm sm:text-xs rounded-xl transition disabled:opacity-50"
              >
                Không hủy
              </button>
              <button
                disabled={removePending}
                onClick={() => removeParticipantMutation.mutate({ participantId: removeParticipant.id, forfeitDeposit: false })}
                className="min-h-11 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm sm:text-xs rounded-xl shadow-md active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {removePending ? 'Đang xóa...' : 'Xác nhận hủy slot'}
              </button>
            </div>
          ))
        }
      >
        {removeParticipant && (
          <div className="text-sm sm:text-xs text-slate-700 leading-relaxed space-y-3">
            {removeDepositChoice ? (
              <>
                <p>
                  Người này là <b>Khách Vãng Lai</b> đã chuyển cọc{' '}
                  <b className="text-emerald-700">{formatVnd(removeParticipant.depositAmount)}</b> và không tới sân.
                </p>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 text-xs space-y-1">
                  <p className="font-bold">Cách xử lý tiền cọc:</p>
                  <p>
                    • <b>Giữ cọc vào quỹ:</b> slot được mở lại, tiền cọc {formatVnd(removeParticipant.depositAmount)} ghi vào
                    doanh thu ca.
                  </p>
                  <p>
                    • <b>Hoàn cọc:</b> slot được mở lại và không tính vào doanh thu.
                  </p>
                </div>
              </>
            ) : (
              <p>
                Hủy lượt đăng ký của <b className="text-slate-900">{participantDisplayName(removeParticipant)}</b> để nhường slot
                trống cho người khác?
              </p>
            )}
          </div>
        )}
      </BottomSheet>

      {/* QR phóng to */}
      <BottomSheet open={showQrModal} onClose={() => setShowQrModal(false)} title="Quét mã để điểm danh">
        <div className="text-center space-y-4 pb-2">
          <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-200 inline-block">
            <QRCodeSVG value={checkinDirectUrl || session.checkinToken || 'NONE'} size={240} />
          </div>
          <div className="space-y-1">
            <span className="text-3xl font-mono font-black text-slate-900 tracking-wider block">{session.checkinToken}</span>
            <p className="text-sm sm:text-xs text-slate-500 font-medium">
              Thành viên tự điểm danh từ 30 phút trước giờ bắt đầu đến hết ca. Quét bằng Camera / Zalo hoặc nhập mã.
            </p>
          </div>
        </div>
      </BottomSheet>

      {/* Thêm sân */}
      <BottomSheet
        open={showAddCourtModal}
        onClose={() => !updateCourtsMutation.isPending && setShowAddCourtModal(false)}
        closeOnBackdrop={!updateCourtsMutation.isPending}
        title="Thêm sân mới vào ca"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={updateCourtsMutation.isPending}
              onClick={() => setShowAddCourtModal(false)}
              className="min-h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm sm:text-xs rounded-xl transition disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={updateCourtsMutation.isPending}
              onClick={handleAddCourt}
              className="min-h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-xs rounded-xl shadow-md active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateCourtsMutation.isPending ? 'Đang thêm...' : 'Xác nhận thêm sân'}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-sm sm:text-xs">
          <div>
            <label htmlFor="host-new-court-name" className="block text-slate-700 font-bold mb-1.5">
              Tên sân muốn thêm (VD: Sân 3, Sân VIP...)
            </label>
            <input
              id="host-new-court-name"
              type="text"
              value={newCourtNameInput}
              onChange={(e) => setNewCourtNameInput(e.target.value)}
              placeholder="Nhập tên sân (VD: Sân 3)"
              className="w-full min-h-11 border border-slate-300 rounded-xl px-3 text-base text-slate-900 font-bold focus:outline-none focus:border-slate-900"
            />
          </div>
          {(() => {
            const nextMax = suggestMaxSlots(courtList.length + 1, session.bookedSlots)
            return (
              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-950 space-y-1 text-xs">
                <p>
                  • Hiện tại: <b>{courtList.length} Sân ({session.maxSlots} người)</b>
                </p>
                <p>
                  • Sau khi thêm:{' '}
                  <b>
                    {courtList.length + 1} Sân ({nextMax ?? session.maxSlots} người)
                  </b>
                  {nextMax ? ' (8 slot/sân)' : ' (giữ nguyên vì đã có nhiều người đăng ký)'}
                </p>
              </div>
            )
          })()}
        </div>
      </BottomSheet>

      {/* Cài đặt sân (đổi tên, số slot, xóa sân) */}
      <CourtSettingsSheet
        open={showCourtEditModal}
        onClose={() => setShowCourtEditModal(false)}
        initialCourtNames={courtList.join(', ')}
        initialMaxSlots={session.maxSlots || 8}
        bookedSlots={session.bookedSlots}
        courtList={courtList}
        pending={updateCourtsMutation.isPending}
        onSave={({ courtNames, maxSlots }) =>
          updateCourtsMutation.mutate(
            { newCourtNames: courtNames, newMaxSlots: maxSlots },
            {
              onSuccess: () => {
                setShowCourtEditModal(false)
                showToast('Đã lưu cấu hình sân!', 'success')
              },
            }
          )
        }
        onRequestRemoveCourt={(c) => {
          if (courtList.length <= 1) {
            showToast('Phải giữ lại tối thiểu 1 sân để tổ chức ca đánh!', 'error')
            return
          }
          setShowCourtEditModal(false)
          setConfirmRemoveCourt(c)
        }}
      />

      <ConfirmSheet
        open={!!confirmRemoveCourt}
        onClose={() => setConfirmRemoveCourt(null)}
        title="Xóa sân khỏi ca"
        confirmLabel="Xóa sân này"
        pendingLabel="Đang xóa..."
        cancelLabel="Giữ lại"
        destructive
        pending={updateCourtsMutation.isPending}
        onConfirm={handleConfirmRemoveCourt}
      >
        <p>
          Đóng và xóa <b>[{confirmRemoveCourt}]</b> khỏi ca đánh này?
        </p>
      </ConfirmSheet>

      {/* Sửa trận đấu */}
      <BottomSheet
        open={!!editingMatch}
        onClose={() => !updateMatchMutation.isPending && setEditingMatch(null)}
        closeOnBackdrop={!updateMatchMutation.isPending}
        title="Chỉnh sửa trận đấu"
        panelClassName="sm:max-w-lg"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEditingMatch(null)}
              disabled={updateMatchMutation.isPending}
              className="min-h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm sm:text-xs rounded-xl transition disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={updateMatchMutation.isPending}
              onClick={handleSaveEditedMatch}
              className="min-h-11 bg-slate-950 hover:bg-slate-800 text-white font-black text-sm sm:text-xs rounded-xl shadow-md active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMatchMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        }
      >
        {editingMatch && (
          <div className="space-y-5 text-sm sm:text-xs">
            <div className="space-y-2">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">1. Đội chiến thắng</span>
              <div className="grid grid-cols-2 gap-2">
                {(['A', 'B'] as const).map((team) => (
                  <button
                    key={team}
                    type="button"
                    aria-pressed={editMatchWinningTeam === team}
                    onClick={() => setEditMatchWinningTeam(team)}
                    className={`min-h-12 px-3 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 border-2 cursor-pointer ${
                      editMatchWinningTeam === team
                        ? team === 'A'
                          ? 'bg-blue-50 border-blue-600 text-blue-900'
                          : 'bg-rose-50 border-rose-600 text-rose-900'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${team === 'A' ? 'bg-blue-600' : 'bg-rose-600'}`} />
                    <span>{team === 'A' ? 'Team Blue' : 'Team Red'}</span>
                    {editMatchWinningTeam === team && <span>👑</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">2. Người chơi 2 đội</span>
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-blue-900">Team Blue (Đội A)</span>
                <PlayerSelect
                  value={editMatchTeamAP1}
                  onChange={setEditMatchTeamAP1}
                  options={rosterUsers}
                  playerStatsMap={playerStatsMap}
                  placeholder="-- Chọn Người 1 --"
                  colorTheme="blue"
                  allowClear={false}
                  ariaLabel="Team Blue - Vị trí 1"
                />
                <PlayerSelect
                  value={editMatchTeamAP2}
                  onChange={setEditMatchTeamAP2}
                  options={rosterUsers}
                  playerStatsMap={playerStatsMap}
                  placeholder="-- Trống (Đánh đơn) --"
                  colorTheme="blue"
                  allowClear={true}
                  ariaLabel="Team Blue - Vị trí 2"
                />
              </div>
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-rose-900">Team Red (Đội B)</span>
                <PlayerSelect
                  value={editMatchTeamBP1}
                  onChange={setEditMatchTeamBP1}
                  options={rosterUsers}
                  playerStatsMap={playerStatsMap}
                  placeholder="-- Chọn Người 1 --"
                  colorTheme="rose"
                  allowClear={false}
                  ariaLabel="Team Red - Vị trí 1"
                />
                <PlayerSelect
                  value={editMatchTeamBP2}
                  onChange={setEditMatchTeamBP2}
                  options={rosterUsers}
                  playerStatsMap={playerStatsMap}
                  placeholder="-- Trống (Đánh đơn) --"
                  colorTheme="rose"
                  allowClear={true}
                  ariaLabel="Team Red - Vị trí 2"
                />
              </div>

              <div>
                <label htmlFor="host-edit-match-court" className="block text-xs font-bold text-slate-700 mb-1">
                  Sân thi đấu
                </label>
                <select
                  id="host-edit-match-court"
                  value={editMatchCourtName}
                  onChange={(e) => setEditMatchCourtName(e.target.value)}
                  className="w-full min-h-11 border border-slate-300 rounded-xl px-2.5 text-base sm:text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 bg-white"
                >
                  {courtList.map((c) => (
                    <option key={c} value={c}>
                      🏸 {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Xóa trận: tách xa nút Lưu */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteMatchId(editingMatch.id)}
                className="min-h-11 px-3 text-sm sm:text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Xóa trận này</span>
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      <ConfirmSheet
        open={confirmDeleteMatchId !== null}
        onClose={() => setConfirmDeleteMatchId(null)}
        title="Xác nhận xóa trận đấu"
        confirmLabel="Đồng ý xóa"
        pendingLabel="Đang xóa..."
        destructive
        pending={deleteMatchMutation.isPending}
        onConfirm={() => confirmDeleteMatchId !== null && deleteMatchMutation.mutate(confirmDeleteMatchId)}
      >
        <ul className="list-disc pl-4 space-y-1">
          <li>Trận đấu bị xóa khỏi lịch sử của sân.</li>
          <li>Số set đã đánh của các người chơi được hoàn tác.</li>
          <li>Tỉ số Thắng / Thua và điểm Elo/Rank được tính lại.</li>
        </ul>
      </ConfirmSheet>

      {/* Hủy ca */}
      <CancelSessionSheet
        open={showCancelSession}
        onClose={() => setShowCancelSession(false)}
        sessionTitle={session.title}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        pending={cancelSessionMutation.isPending}
        error={cancelSessionError}
        onConfirm={() => cancelSessionMutation.mutate(cancelReason.trim())}
      />

      {/* Hoàn tác kết quả trận vừa ghi (5 giây) */}
      <UndoSnackbar
        snackKey={undoMatch?.key ?? null}
        message={undoMatch?.message ?? ''}
        pending={undoMatchMutation.isPending}
        onUndo={() => undoMatch && undoMatchMutation.mutate(undoMatch)}
        onDismiss={() => setUndoMatch(null)}
      />
    </div>
  )
}
