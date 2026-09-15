/**
 * Helper to safely parse ISO dates from backend (with or without timezone offset)
 * Ensures standard local representation across all browsers/devices.
 */
export function parseServerDate(dateStr: string | Date | null | undefined): Date {
  if (!dateStr) return new Date(NaN)
  if (dateStr instanceof Date) return dateStr

  // If date string contains space like "2026-09-15 15:52:00", convert to ISO "2026-09-15T15:52:00"
  let formatted = dateStr.trim().replace(' ', 'T')
  return new Date(formatted)
}

/**
 * Format time to "HH:mm" (e.g. "15:30") or "hh:mm a" (e.g. "03:30 PM")
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
 * Format full date time for display (e.g. "Thứ Ba, 15/09", "15:00")
 */
export function formatSessionDateTime(dateStr: string | Date | null | undefined): { day: string; time: string } {
  const d = parseServerDate(dateStr)
  if (isNaN(d.getTime())) return { day: '', time: '' }
  const day = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return { day, time }
}
