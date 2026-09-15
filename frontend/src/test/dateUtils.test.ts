import { describe, it, expect } from 'vitest'
import { formatMatchTime, formatSessionDateTime, parseServerDate } from '../lib/dateUtils'

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

