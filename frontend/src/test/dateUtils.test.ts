import { describe, it, expect } from 'vitest'
import { formatMatchTime, formatSessionDateTime, parseServerDate } from '../lib/dateUtils'

describe('dateUtils test suite', () => {
  it('parses server UTC ISO datetime strings and converts to local GMT+7', () => {
    // 09:05:00 UTC = 16:05:00 in Vietnam (GMT+7)
    const d = parseServerDate('2026-08-30T09:05:00')
    expect(d.getTime()).not.toBeNaN()
    const formatted = formatMatchTime('2026-08-30T09:05:00')
    expect(formatted).toMatch(/16:05|04:05/)
  })

  it('preserves already-offset ISO datetime strings', () => {
    const formatted = formatMatchTime('2026-08-30T16:05:00+07:00')
    expect(formatted).toMatch(/16:05|04:05/)
  })

  it('formats session datetime with day and time correctly', () => {
    const result = formatSessionDateTime('2026-09-15T06:00:00Z') // 06:00 UTC = 13:00 GMT+7
    expect(result.day).toContain('15/09')
    expect(result.time).toBe('13:00')
  })
})
