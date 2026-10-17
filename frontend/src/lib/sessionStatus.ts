import { SessionItem } from '../types'
import { parseServerDateTime } from './dateUtils'

export type EffectiveSessionStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

const KNOWN: EffectiveSessionStatus[] = ['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED']

/**
 * Trạng thái ca dùng chung cho mọi màn hình.
 * Ưu tiên `effectiveStatus` do server tính theo giờ (backend mới); backend cũ không có
 * trường này thì tự tính theo giờ thực tế (giờ ca hiểu theo giờ Việt Nam).
 */
export function getEffectiveSessionStatus(
  session: Pick<SessionItem, 'status' | 'startTime' | 'endTime'> & {
    effectiveStatus?: SessionItem['effectiveStatus']
  },
  now: number = Date.now()
): EffectiveSessionStatus {
  if (session.effectiveStatus && KNOWN.includes(session.effectiveStatus)) return session.effectiveStatus
  if (session.status === 'CANCELLED') return 'CANCELLED'
  const start = parseServerDateTime(session.startTime).getTime()
  const end = parseServerDateTime(session.endTime).getTime()
  if (!isNaN(end) && now > end) return 'COMPLETED'
  if (!isNaN(start) && !isNaN(end) && now >= start && now <= end) return 'ACTIVE'
  if (isNaN(start) || isNaN(end)) {
    // Thiếu giờ hợp lệ: dựa vào trạng thái server
    return session.status
  }
  return 'UPCOMING'
}

/** Ca đã đóng (hủy / kết thúc): không cho tham gia, không cho hủy ca */
export const isSessionClosed = (status: EffectiveSessionStatus) => status === 'CANCELLED' || status === 'COMPLETED'

export const SESSION_STATUS_LABEL: Record<EffectiveSessionStatus, string> = {
  ACTIVE: '• Đang diễn ra',
  UPCOMING: 'Sắp diễn ra',
  COMPLETED: 'Đã kết thúc',
  CANCELLED: 'Đã hủy',
}
