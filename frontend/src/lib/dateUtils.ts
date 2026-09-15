/**
 * Helper to safely parse ISO dates from backend (with or without timezone offset)
 * Ensures standard local representation across all browsers/devices.
 *
 * Note: Database timestamps saved in UTC without timezone offset (e.g. "2026-08-30T09:05:00")
 * will be treated as UTC ISO string to accurately convert to Vietnam Local Time (GMT+7).
 */
export function parseServerDate(dateStr: string | Date | null | undefined): Date {
  if (!dateStr) return new Date(NaN)
  if (dateStr instanceof Date) return dateStr

  let formatted = String(dateStr).trim().replace(' ', 'T')

  // If no timezone offset (no 'Z' and no '+/-HH:mm'), append 'Z' to treat as UTC from database
  const hasTimezone = /Z|[+-]\d{2}(:\d{2})?$/.test(formatted)
  if (!hasTimezone) {
    formatted = `${formatted}Z`
  }

  return new Date(formatted)
}

/**
 * Format time to "HH:mm" (e.g. "16:05") or "hh:mm a" (e.g. "04:05 PM")
 */
export function formatMatchTime(dateStr: string | Date | null | undefined): string {
  const d = parseServerDate(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format full date time for display (e.g. "Thứ Ba, 15/09", "16:05")
 */
export function formatSessionDateTime(dateStr: string | Date | null | undefined): { day: string; time: string } {
  const d = parseServerDate(dateStr)
  if (isNaN(d.getTime())) return { day: '', time: '' }
  const day = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return { day, time }
}
