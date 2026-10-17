/**
 * Thời gian từ backend là LocalDateTime theo giờ Việt Nam (Asia/Ho_Chi_Minh, +07:00),
 * ví dụ "2026-09-20T16:03:00" — KHÔNG kèm múi giờ. Nếu parse bằng `new Date(str)` thì
 * trình duyệt hiểu theo múi giờ của điện thoại → máy để múi giờ khác sẽ lệch giờ.
 *
 * Mọi chỗ đọc/hiển thị giờ ca phải đi qua các hàm dưới đây:
 *  - parseServerDateTime: chuỗi không có offset → hiểu là giờ VN (+07:00); có Z/offset → parse bình thường.
 *  - format*: hiển thị theo timeZone 'Asia/Ho_Chi_Minh' bất kể múi giờ thiết bị.
 *  - toVnDateTimeInput: Date → "yyyy-MM-ddTHH:mm" (giờ VN) cho ô <input type="datetime-local">.
 */

export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh'

/** Việt Nam dùng +07:00 cố định (không có giờ mùa hè) */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

const OFFSETLESS_DATETIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2})(?:\.(\d+))?)?$/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

type DateInput = string | Date | null | undefined

/**
 * Parse thời gian từ server thành Date (mốc thời gian tuyệt đối).
 * - "yyyy-MM-ddTHH:mm[:ss[.SSS…]]" (không offset) → giờ Việt Nam (+07:00)
 * - "yyyy-MM-dd" → 00:00 giờ Việt Nam
 * - Có "Z" hoặc "+hh:mm" → parse bình thường
 * - Rỗng / không hợp lệ → Invalid Date
 */
export function parseServerDateTime(input: DateInput): Date {
  if (!input) return new Date(NaN)
  if (input instanceof Date) return input

  const s = String(input).trim()
  if (!s) return new Date(NaN)

  const m = s.match(OFFSETLESS_DATETIME)
  if (m) {
    const [, date, hm, sec = '00', frac] = m
    // Java có thể trả tới 9 chữ số phần giây lẻ; Date chỉ hiểu tối đa mili giây
    const ms = frac ? `.${frac.slice(0, 3).padEnd(3, '0')}` : ''
    return new Date(`${date}T${hm}:${sec}${ms}+07:00`)
  }
  if (DATE_ONLY.test(s)) return new Date(`${s}T00:00:00+07:00`)

  return new Date(s.replace(' ', 'T'))
}

/** Giữ tên cũ cho các nơi đang dùng — cùng quy tắc với parseServerDateTime */
export const parseServerDate = parseServerDateTime

export interface VnDateParts {
  year: number
  /** 1-12 */
  month: number
  day: number
  hour: number
  minute: number
  second: number
  /** 0 = Chủ nhật … 6 = Thứ bảy */
  weekday: number
}

/** Ngày/giờ "đồng hồ treo tường" ở Việt Nam của một mốc thời gian */
export function getVnParts(d: Date): VnDateParts {
  const shifted = new Date(d.getTime() + VN_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Date → "yyyy-MM-ddTHH:mm" theo giờ VN (giá trị cho <input type="datetime-local">) */
export function toVnDateTimeInput(d: Date): string {
  if (isNaN(d.getTime())) return ''
  const p = getVnParts(d)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** Chuỗi giờ server (hoặc Date) → "yyyy-MM-ddTHH:mm" giờ VN cho ô datetime-local; lỗi → '' */
export function serverToDateTimeInput(input: DateInput): string {
  return toVnDateTimeInput(parseServerDateTime(input))
}

/** Date → "yyyy-MM-ddTHH:mm:ss" giờ VN (định dạng LocalDateTime gửi lên server) */
export function toVnLocalDateTime(d: Date): string {
  if (isNaN(d.getTime())) return ''
  const p = getVnParts(d)
  return `${toVnDateTimeInput(d)}:${pad(p.second)}`
}

/** Khóa ngày "yyyy-MM-dd" theo giờ VN (dùng cho lịch điểm danh) */
export function vnDateKey(input: DateInput): string {
  const d = parseServerDateTime(input)
  if (isNaN(d.getTime())) return ''
  const p = getVnParts(d)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** "HH:mm" giờ VN; lỗi → '' */
export function formatVnTime(input: DateInput): string {
  const d = parseServerDateTime(input)
  if (isNaN(d.getTime())) return ''
  const p = getVnParts(d)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** "dd/MM/yyyy" giờ VN; lỗi → '' */
export function formatVnDate(input: DateInput): string {
  const d = parseServerDateTime(input)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('vi-VN', { timeZone: VN_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Format time to "HH:mm" (e.g. "16:05" or "20:00") theo giờ Việt Nam.
 */
export function formatMatchTime(dateStr: DateInput): string {
  return formatVnTime(dateStr)
}

/**
 * Format full date time for display (e.g. "Thứ Sáu, 18/09", "20:00") theo giờ Việt Nam
 */
export function formatSessionDateTime(dateStr: DateInput): { day: string; time: string } {
  const d = parseServerDateTime(dateStr)
  if (isNaN(d.getTime())) return { day: '', time: '' }
  const day = d.toLocaleDateString('vi-VN', {
    timeZone: VN_TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  })
  return { day, time: formatVnTime(d) }
}

/** Số giờ giữa 2 mốc (làm tròn 1 chữ số thập phân); thiếu/không hợp lệ → null */
export function durationHours(start: DateInput, end: DateInput): number | null {
  const s = parseServerDateTime(start).getTime()
  const e = parseServerDateTime(end).getTime()
  if (isNaN(s) || isNaN(e) || e <= s) return null
  return Math.round(((e - s) / (1000 * 60 * 60)) * 10) / 10
}
