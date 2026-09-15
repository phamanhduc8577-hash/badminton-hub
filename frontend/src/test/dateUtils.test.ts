import { describe, it, expect } from 'vitest'
import { formatMatchTime, formatSessionDateTime, parseServerDate } from '../lib/dateUtils'

describe('dateUtils test suite', () => {
  it('parses server ISO datetime strings consistently', () => {
    const d = parseServerDate('2026-09-15T15:52:00')
    expect(d.getHours()).toBe(15)
    expect(d.getMinutes()).toBe(52)
  })

  it('formats match time into hh:mm or HH:mm properly', () => {
    const formatted = formatMatchTime('2026-09-15T15:52:00')
    expect(formatted).toMatch(/15:52|03:52/)
  })

  it('formats session datetime with day and time correctly', () => {
    const result = formatSessionDateTime('2026-09-15T13:00:00')
    expect(result.day).toContain('15/09')
    expect(result.time).toBe('13:00')
  })
})
