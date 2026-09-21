/**
 * Helper to safely parse ISO dates from backend (with or without timezone offset)
 * Ensures standard local representation across all browsers/devices.
 *
 * Backend returns LocalDateTime in Asia/Ho_Chi_Minh (e.g. "2026-09-20T16:03:00").
 * When a string lacks timezone offset (e.g. no 'Z' or '+07:00'), parsing it with
 * `new Date("2026-09-20T16:03:00")` extracts the exact hours & minutes in local view.
 */
export function parseServerDate(dateStr: string | Date | null | undefined): Date {
  if (!dateStr) return new Date(NaN)
  if (dateStr instanceof Date) return dateStr

  const formatted = String(dateStr).trim().replace(' ', 'T')
  return new Date(formatted)
}

/**
 * Format time to "HH:mm" (e.g. "16:05" or "20:00")
 * Extracts wall-clock hour & minute directly if string format "YYYY-MM-DDTHH:mm:ss"
 * to avoid any client-browser / OS timezone distortion.
 */
export function formatMatchTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return ''
  if (typeof dateStr === 'string') {
    const timeMatch = dateStr.match(/T(\d{2}):(\d{2})/)
    if (timeMatch) {
      return `${timeMatch[1]}:${timeMatch[2]}`
    }
  }

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

