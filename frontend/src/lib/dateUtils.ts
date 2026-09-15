/**
 * Helper to safely parse ISO dates from backend (with or without timezone offset)
 * Ensures standard local representation across all browsers/devices.
 *
 * Session dates (startTime, endTime) are wall-clock times in local Vietnam time (e.g. "2026-09-18T20:00:00").
 * Match creation timestamps (createdAt) are UTC timestamps when serialized without timezone.
 */
export function parseServerDate(dateStr: string | Date | null | undefined): Date {
  if (!dateStr) return new Date(NaN)
  if (dateStr instanceof Date) return dateStr

  const formatted = String(dateStr).trim().replace(' ', 'T')
  return new Date(formatted)
}

/**
 * Format time to "HH:mm" (e.g. "16:05" or "20:00")
 */
export function formatMatchTime(dateStr: string | Date | null | undefined): string {
  const d = parseServerDate(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Format full date time for display (e.g. "Thứ Sáu, 18/09", "20:00")
 */
export function formatSessionDateTime(dateStr: string | Date | null | undefined): { day: string; time: string } {
  const d = parseServerDate(dateStr)
  if (isNaN(d.getTime())) return { day: '', time: '' }
  const day = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return { day, time }
}

