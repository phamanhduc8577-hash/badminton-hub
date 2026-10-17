import { describe, it, expect } from 'vitest'
import {
  durationHours,
  formatMatchTime,
  formatSessionDateTime,
  formatVnDate,
  formatVnTime,
  getVnParts,
  parseServerDate,
  parseServerDateTime,
  serverToDateTimeInput,
  toVnDateTimeInput,
  toVnLocalDateTime,
  vnDateKey,
} from '../lib/dateUtils'

describe('dateUtils test suite', () => {
  it('parses local session datetime strings without shifting timezone', () => {
    // 2026-09-18T20:00:00 -> 20:00 on Friday 18/09
    const d = parseServerDate('2026-09-18T20:00:00')
    expect(d.getTime()).not.toBeNaN()
    const result = formatSessionDateTime('2026-09-18T20:00:00')
    expect(result.day).toContain('18/09')
    expect(result.time).toBe('20:00')
  })

  it('formats match time in 24h format', () => {
    const formatted = formatMatchTime('2026-08-30T16:05:00')
    expect(formatted).toBe('16:05')
  })

  it('handles afternoon sessions correctly (e.g. 13:00 - 16:00)', () => {
    const start = formatSessionDateTime('2026-09-20T13:00:00')
    const end = formatSessionDateTime('2026-09-20T16:00:00')
    expect(start.day).toContain('20/09')
    expect(start.time).toBe('13:00')
    expect(end.time).toBe('16:00')
  })
})

// Kỳ vọng dựng từ UTC → test đúng bất kể múi giờ của máy chạy test
describe('parseServerDateTime (giờ server không kèm múi giờ = giờ Việt Nam)', () => {
  it('chuỗi không offset được hiểu là +07:00', () => {
    expect(parseServerDateTime('2026-09-18T20:00:00').getTime()).toBe(Date.UTC(2026, 8, 18, 13, 0, 0))
    expect(parseServerDateTime('2026-09-18T20:00').getTime()).toBe(Date.UTC(2026, 8, 18, 13, 0, 0))
    expect(parseServerDateTime('2026-09-18 20:00:00').getTime()).toBe(Date.UTC(2026, 8, 18, 13, 0, 0))
  })

  it('giờ sáng sớm VN rơi vào ngày hôm trước theo UTC', () => {
    expect(parseServerDateTime('2026-01-01T05:30:00').getTime()).toBe(Date.UTC(2025, 11, 31, 22, 30, 0))
  })

  it('phần giây lẻ dài kiểu Java (nano giây) chỉ lấy mili giây', () => {
    expect(parseServerDateTime('2026-09-18T20:00:00.123456789').getTime()).toBe(Date.UTC(2026, 8, 18, 13, 0, 0, 123))
    expect(parseServerDateTime('2026-09-18T20:00:00.5').getTime()).toBe(Date.UTC(2026, 8, 18, 13, 0, 0, 500))
  })

  it('chuỗi có Z hoặc offset được parse bình thường', () => {
    expect(parseServerDateTime('2026-09-18T20:00:00Z').getTime()).toBe(Date.UTC(2026, 8, 18, 20, 0, 0))
    expect(parseServerDateTime('2026-09-18T20:00:00+09:00').getTime()).toBe(Date.UTC(2026, 8, 18, 11, 0, 0))
  })

  it('chỉ có ngày → 00:00 giờ VN', () => {
    expect(parseServerDateTime('2026-09-18').getTime()).toBe(Date.UTC(2026, 8, 17, 17, 0, 0))
  })

  it('rỗng / sai định dạng → Invalid Date; Date giữ nguyên', () => {
    expect(parseServerDateTime(null).getTime()).toBeNaN()
    expect(parseServerDateTime('').getTime()).toBeNaN()
    expect(parseServerDateTime('không phải ngày').getTime()).toBeNaN()
    const d = new Date(Date.UTC(2026, 0, 1))
    expect(parseServerDateTime(d)).toBe(d)
  })

  it('hiển thị theo giờ VN dù mốc thời gian đến từ UTC', () => {
    const d = new Date(Date.UTC(2026, 8, 18, 13, 5, 0)) // = 20:05 giờ VN
    expect(formatVnTime(d)).toBe('20:05')
    expect(formatMatchTime(d)).toBe('20:05')
    expect(formatSessionDateTime(d).time).toBe('20:05')
    expect(formatVnDate(new Date(Date.UTC(2026, 8, 18, 18, 0, 0)))).toBe('19/09/2026') // 01:00 sáng 19/09 giờ VN
    expect(getVnParts(new Date(Date.UTC(2026, 8, 18, 18, 0, 0)))).toMatchObject({ year: 2026, month: 9, day: 19, hour: 1 })
  })

  it('ô datetime-local: chuỗi server ↔ giờ VN giữ nguyên khi đi vòng', () => {
    expect(serverToDateTimeInput('2026-09-18T20:00:00')).toBe('2026-09-18T20:00')
    expect(toVnDateTimeInput(parseServerDateTime('2026-09-18T20:00'))).toBe('2026-09-18T20:00')
    expect(toVnLocalDateTime(new Date(Date.UTC(2026, 8, 18, 13, 0, 7)))).toBe('2026-09-18T20:00:07')
    expect(serverToDateTimeInput('')).toBe('')
  })

  it('khóa ngày VN và số giờ ca', () => {
    expect(vnDateKey('2026-09-18T23:30:00')).toBe('2026-09-18')
    expect(vnDateKey(new Date(Date.UTC(2026, 8, 18, 17, 30)))).toBe('2026-09-19')
    expect(durationHours('2026-09-18T18:00:00', '2026-09-18T21:00:00')).toBe(3)
    expect(durationHours('2026-09-18T18:00:00', '2026-09-18T18:00:00')).toBeNull()
  })
})
