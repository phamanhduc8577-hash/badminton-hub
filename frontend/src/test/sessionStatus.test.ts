import { describe, it, expect } from 'vitest'
import { getEffectiveSessionStatus, isSessionClosed, SESSION_STATUS_LABEL } from '../lib/sessionStatus'

const base = {
  startTime: '2026-09-15T18:00:00',
  endTime: '2026-09-15T21:00:00',
}
// Giờ ca là giờ Việt Nam (+07:00) bất kể múi giờ máy chạy test
const at = (vnWallClock: string) => new Date(`${vnWallClock}+07:00`).getTime()

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

describe('getEffectiveSessionStatus — ưu tiên effectiveStatus do server tính', () => {
  it('dùng effectiveStatus khi có, kể cả khi giờ máy cho kết quả khác', () => {
    expect(
      getEffectiveSessionStatus({ ...base, status: 'UPCOMING', effectiveStatus: 'COMPLETED' }, at('2026-09-15T17:00:00'))
    ).toBe('COMPLETED')
    expect(
      getEffectiveSessionStatus({ ...base, status: 'ACTIVE', effectiveStatus: 'ACTIVE' }, at('2026-09-15T08:00:00'))
    ).toBe('ACTIVE')
  })

  it('effectiveStatus CANCELLED thắng mọi thứ', () => {
    expect(
      getEffectiveSessionStatus({ ...base, status: 'UPCOMING', effectiveStatus: 'CANCELLED' }, at('2026-09-15T19:00:00'))
    ).toBe('CANCELLED')
  })

  it('thiếu / không hợp lệ thì tự tính theo giờ (backend cũ)', () => {
    expect(getEffectiveSessionStatus({ ...base, status: 'UPCOMING', effectiveStatus: undefined }, at('2026-09-15T19:00:00'))).toBe('ACTIVE')
    expect(
      getEffectiveSessionStatus({ ...base, status: 'UPCOMING', effectiveStatus: 'WHATEVER' as any }, at('2026-09-15T22:00:00'))
    ).toBe('COMPLETED')
  })

  it('isSessionClosed: chỉ hủy / kết thúc', () => {
    expect(isSessionClosed('CANCELLED')).toBe(true)
    expect(isSessionClosed('COMPLETED')).toBe(true)
    expect(isSessionClosed('ACTIVE')).toBe(false)
    expect(isSessionClosed('UPCOMING')).toBe(false)
  })
})
