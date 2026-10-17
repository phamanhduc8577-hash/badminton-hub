import { describe, it, expect } from 'vitest'
import { getEffectiveSessionStatus, SESSION_STATUS_LABEL } from '../lib/sessionStatus'

const base = {
  startTime: '2026-09-15T18:00:00',
  endTime: '2026-09-15T21:00:00',
}
const at = (iso: string) => new Date(iso).getTime()

describe('getEffectiveSessionStatus', () => {
  it('trước giờ bắt đầu → UPCOMING (kể cả server ghi ACTIVE)', () => {
    expect(getEffectiveSessionStatus({ ...base, status: 'ACTIVE' }, at('2026-09-15T17:59:00'))).toBe('UPCOMING')
  })

  it('trong khung giờ → ACTIVE (kể cả server vẫn ghi UPCOMING)', () => {
    expect(getEffectiveSessionStatus({ ...base, status: 'UPCOMING' }, at('2026-09-15T18:00:00'))).toBe('ACTIVE')
    expect(getEffectiveSessionStatus({ ...base, status: 'UPCOMING' }, at('2026-09-15T21:00:00'))).toBe('ACTIVE')
  })

  it('sau giờ kết thúc → COMPLETED', () => {
    expect(getEffectiveSessionStatus({ ...base, status: 'UPCOMING' }, at('2026-09-15T21:00:01'))).toBe('COMPLETED')
  })

  it('ca đã hủy luôn là CANCELLED', () => {
    expect(getEffectiveSessionStatus({ ...base, status: 'CANCELLED' }, at('2026-09-15T19:00:00'))).toBe('CANCELLED')
  })

  it('thiếu giờ hợp lệ → giữ trạng thái server', () => {
    expect(getEffectiveSessionStatus({ startTime: '', endTime: '', status: 'UPCOMING' })).toBe('UPCOMING')
  })

  it('có nhãn tiếng Việt cho mọi trạng thái', () => {
    expect(SESSION_STATUS_LABEL.ACTIVE).toMatch(/Đang diễn ra/)
    expect(SESSION_STATUS_LABEL.UPCOMING).toBe('Sắp diễn ra')
    expect(SESSION_STATUS_LABEL.COMPLETED).toBe('Đã kết thúc')
    expect(SESSION_STATUS_LABEL.CANCELLED).toBe('Đã hủy')
  })
})
