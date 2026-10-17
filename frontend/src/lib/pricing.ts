import { SessionItem, ViewerPricing } from '../types'

/**
 * Bản sao phía giao diện của backend `PricingCalculator` — chỉ dùng khi server chưa trả
 * `viewerPricing` (khách chưa đăng nhập / backend cũ). Giữ đúng từng quy tắc:
 *  - Gói 2 tiếng chỉ áp dụng khi ca có giá 2h NAM của hạng (thành viên / vãng lai).
 *  - Nữ không có giá 2h riêng thì dùng giá nữ full ca.
 *  - Giá 0 là giá hợp lệ (dùng `??`, không dùng `||`).
 */

type Gender = 'MALE' | 'FEMALE' | 'OTHER' | undefined | null

export type SessionPrices = Pick<
  SessionItem,
  | 'memberMalePrice'
  | 'memberFemalePrice'
  | 'guestMalePrice'
  | 'guestFemalePrice'
  | 'memberMalePrice2h'
  | 'memberFemalePrice2h'
  | 'guestMalePrice2h'
  | 'guestFemalePrice2h'
>

const isSet = (v: number | null | undefined): v is number => v !== null && v !== undefined

/** Giá gốc theo hạng, giới tính và gói (2h hoặc full ca) — giống PricingCalculator.baseFee */
export function baseFee(s: SessionPrices, memberTier: boolean, gender: Gender, twoHours: boolean): number | null {
  const female = gender === 'FEMALE'
  const male2h = memberTier ? s.memberMalePrice2h : s.guestMalePrice2h
  const female2h = memberTier ? s.memberFemalePrice2h : s.guestFemalePrice2h
  const maleFull = memberTier ? s.memberMalePrice : s.guestMalePrice
  const femaleFull = memberTier ? s.memberFemalePrice : s.guestFemalePrice

  if (twoHours && isSet(male2h)) {
    return female ? (female2h ?? femaleFull ?? null) : male2h
  }
  return (female ? femaleFull : maleFull) ?? null
}

/** Ca có giá 2h áp được cho hạng + giới tính này — giống PricingCalculator.hasTwoHourPrice (dùng lúc điểm danh) */
export function hasTwoHourPrice(s: SessionPrices, memberTier: boolean, gender: Gender): boolean {
  const male2h = memberTier ? s.memberMalePrice2h : s.guestMalePrice2h
  const female2h = memberTier ? s.memberFemalePrice2h : s.guestFemalePrice2h
  return isSet(male2h) && (gender !== 'FEMALE' || isSet(female2h))
}

/** Hạng giá của người dùng khi tự đăng ký: chỉ Host và thành viên cố định (FIXED) được giá Thành viên */
export function isMemberTier(user: { role?: string; membershipType?: string } | null | undefined): boolean {
  return user?.role === 'HOST' || user?.membershipType === 'FIXED'
}

/** Giá dự kiến cho người xem tự tính ở giao diện (fallback khi server không trả viewerPricing) */
export function computeViewerPricing(
  s: SessionPrices,
  user: { role?: string; membershipType?: string; gender?: Gender } | null | undefined
): ViewerPricing {
  const memberTier = isMemberTier(user)
  const gender = user?.gender
  const male2h = memberTier ? s.memberMalePrice2h : s.guestMalePrice2h
  return {
    memberTier,
    fullPrice: baseFee(s, memberTier, gender, false) ?? 0,
    twoHourPrice: isSet(male2h) ? baseFee(s, memberTier, gender, true) : null,
  }
}

/** Ưu tiên giá server trả về cho người xem; thiếu thì tự tính theo cùng công thức */
export function resolveViewerPricing(
  session: SessionPrices & { viewerPricing?: ViewerPricing | null },
  user: { role?: string; membershipType?: string; gender?: Gender } | null | undefined
): ViewerPricing {
  return session.viewerPricing ?? computeViewerPricing(session, user)
}

/**
 * Người xem có phải cọc khi tham gia không: ưu tiên cờ `requiresDeposit` của server;
 * thiếu thì đoán như trước (Host / cố định / đã từng tham gia → miễn cọc).
 */
export function resolveRequiresDeposit(
  session: Pick<SessionItem, 'depositAmount'> & { requiresDeposit?: boolean | null },
  user: { role?: string; membershipType?: string; sessionsAttended?: number } | null | undefined
): boolean {
  if (session.requiresDeposit !== undefined && session.requiresDeposit !== null) return session.requiresDeposit
  if (!(Number(session.depositAmount) > 0)) return false
  if (isMemberTier(user)) return false
  return (user?.sessionsAttended ?? 0) <= 0
}

/** "20.000đ" */
export const formatMoney = (n: number | null | undefined) => `${Number(n ?? 0).toLocaleString('vi-VN')}đ`
