import { SessionItem } from '../types'
import { parseServerDate } from './dateUtils'

export type EffectiveSessionStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

/**
 * Trạng thái ca tính theo giờ thực tế (backend chưa tự cập nhật cột status theo thời gian).
 * Dùng chung cho danh sách ca và trang chi tiết ca để 2 nơi luôn hiển thị giống nhau.
 */
export function getEffectiveSessionStatus(
  session: Pick<SessionItem, 'status' | 'startTime' | 'endTime'>,
  now: number = Date.now()
): EffectiveSessionStatus {
  if (session.status === 'CANCELLED') return 'CANCELLED'
  const start = parseServerDate(session.startTime).getTime()
  const end = parseServerDate(session.endTime).getTime()
  if (!isNaN(end) && now > end) return 'COMPLETED'
  if (!isNaN(start) && !isNaN(end) && now >= start && now <= end) return 'ACTIVE'
  if (isNaN(start) || isNaN(end)) {
    // Thiếu giờ hợp lệ: dựa vào trạng thái server
    return session.status
  }
  return 'UPCOMING'
}

export const SESSION_STATUS_LABEL: Record<EffectiveSessionStatus, string> = {
  ACTIVE: '• Đang diễn ra',
  UPCOMING: 'Sắp diễn ra',
  COMPLETED: 'Đã kết thúc',
  CANCELLED: 'Đã hủy',
}
