import { Participant } from '../../types'

/**
 * Participant phía Host có thêm các trường mới từ backend (đợt 2.3):
 * - paidAt: thời điểm thu tiền
 * - canUndoPayment: server cho phép hoàn tác thu tiền (Host, trong 7 ngày sau khi ca kết thúc)
 */
export type HostParticipant = Participant & { paidAt?: string; canUndoPayment?: boolean }

export interface PlayerSetStats {
  totalSets: number
  wins: number
  losses: number
  lastCourt?: string
  courtHistory: string[]
}

export const EMPTY_STATS: PlayerSetStats = { totalSets: 0, wins: 0, losses: 0, courtHistory: [] }

/** Lý do chọn nhanh khi hoàn tác thu tiền */
export const UNDO_PAYMENT_REASONS = ['Bấm nhầm', 'Sai hình thức thanh toán', 'Khách chưa chuyển'] as const

export const MIN_SLOTS = 1
export const MAX_SLOTS = 60

export const participantDisplayName = (p: Pick<Participant, 'name' | 'phone'>, idx?: number) =>
  p.name && p.name !== 'N/A' ? p.name : p.phone || (idx !== undefined ? `Tay vợt #${idx + 1}` : 'Tay vợt')

export const formatVnd = (n: number | undefined | null) => `${Number(n || 0).toLocaleString('vi-VN')}đ`

/** Lấy thông báo lỗi tiếng Việt từ server, nếu không có thì dùng câu mặc định */
export const getErrorMessage = (err: any, fallback: string): string =>
  err?.response?.data?.message || fallback

/**
 * Kiểm tra ô số slot (giữ dạng chuỗi để người dùng xóa trống / gõ lại thoải mái).
 * Trả về thông báo lỗi, hoặc null nếu hợp lệ.
 */
export const validateSlotCount = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed) return 'Vui lòng nhập số slot.'
  if (!/^\d+$/.test(trimmed)) return 'Số slot chỉ gồm chữ số.'
  const n = Number(trimmed)
  if (n < MIN_SLOTS || n > MAX_SLOTS) return `Số slot phải từ ${MIN_SLOTS} đến ${MAX_SLOTS}.`
  return null
}

/** Có thể xác nhận đã nhận cọc (khách vãng lai, có cọc, cọc đang chờ, chưa thanh toán) */
export const canConfirmDeposit = (p: Participant) =>
  p.paymentStatus !== 'PAID' && p.isGuest && Number(p.depositAmount) > 0 && p.depositStatus === 'PENDING'

/** Có thể xóa khỏi ca (chưa điểm danh, chưa vắng, chưa thanh toán) */
export const removeBlockReason = (p: Participant): string | null => {
  if (p.paymentStatus === 'PAID') return 'Đã thanh toán — hoàn tác thu tiền trước khi xóa'
  if (p.checkinStatus === 'CHECKED_IN') return 'Đã điểm danh — hủy điểm danh trước khi xóa'
  return null
}

export const editBillBlockReason = (p: Participant): string | null =>
  p.paymentStatus === 'PAID' ? 'Đã thanh toán — hoàn tác thu tiền trước khi sửa' : null

export const paymentMethodLabel = (m?: 'VIETQR' | 'CASH') => (m === 'CASH' ? 'Tiền mặt' : 'VietQR')
