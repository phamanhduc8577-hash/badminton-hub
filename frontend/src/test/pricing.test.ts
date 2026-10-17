import { describe, it, expect } from 'vitest'
import {
  baseFee,
  computeViewerPricing,
  hasTwoHourPrice,
  isMemberTier,
  resolveRequiresDeposit,
  resolveViewerPricing,
  SessionPrices,
} from '../lib/pricing'

const full: SessionPrices = {
  memberMalePrice: 50000,
  memberFemalePrice: 40000,
  guestMalePrice: 60000,
  guestFemalePrice: 50000,
}

// Ma trận giống backend PricingCalculator.baseFee
describe('pricing.baseFee — khớp PricingCalculator', () => {
  const all2h: SessionPrices = {
    ...full,
    memberMalePrice2h: 35000,
    memberFemalePrice2h: 30000,
    guestMalePrice2h: 45000,
    guestFemalePrice2h: 38000,
  }

  it.each([
    // [mô tả, giá ca, memberTier, giới tính, 2h, kỳ vọng]
    ['TV nam full', all2h, true, 'MALE', false, 50000],
    ['TV nữ full', all2h, true, 'FEMALE', false, 40000],
    ['VL nam full', all2h, false, 'MALE', false, 60000],
    ['VL nữ full', all2h, false, 'FEMALE', false, 50000],
    ['TV nam 2h', all2h, true, 'MALE', true, 35000],
    ['TV nữ 2h', all2h, true, 'FEMALE', true, 30000],
    ['VL nam 2h', all2h, false, 'MALE', true, 45000],
    ['VL nữ 2h', all2h, false, 'FEMALE', true, 38000],
    ['OTHER tính như nam', all2h, false, 'OTHER', true, 45000],
    // Không có giá 2h nam của hạng → giá full ca (kể cả có giá 2h nữ)
    ['VL nữ 2h nhưng thiếu giá 2h nam', { ...full, guestFemalePrice2h: 38000 }, false, 'FEMALE', true, 50000],
    ['VL nam 2h khi ca không có 2h', full, false, 'MALE', true, 60000],
    // Có giá 2h nam nhưng thiếu 2h nữ → nữ dùng giá nữ full ca
    ['TV nữ 2h thiếu giá 2h nữ', { ...full, memberMalePrice2h: 35000 }, true, 'FEMALE', true, 40000],
    // Giá 2h của hạng khác không áp dụng
    ['VL nam 2h, chỉ có giá 2h TV', { ...full, memberMalePrice2h: 35000 }, false, 'MALE', true, 60000],
    // Giá 0 là giá hợp lệ (?? chứ không phải ||)
    ['giá 2h = 0 vẫn được dùng', { ...full, guestMalePrice2h: 0 }, false, 'MALE', true, 0],
    ['giá 2h nữ = 0 vẫn được dùng', { ...full, guestMalePrice2h: 45000, guestFemalePrice2h: 0 }, false, 'FEMALE', true, 0],
  ] as const)('%s', (_label, prices, memberTier, gender, twoHours, expected) => {
    expect(baseFee(prices, memberTier, gender, twoHours)).toBe(expected)
  })
})

describe('pricing.hasTwoHourPrice — khớp PricingCalculator.hasTwoHourPrice', () => {
  it('cần giá 2h nam của hạng; nữ cần thêm giá 2h nữ', () => {
    expect(hasTwoHourPrice({ ...full, guestMalePrice2h: 45000 }, false, 'MALE')).toBe(true)
    expect(hasTwoHourPrice({ ...full, guestMalePrice2h: 45000 }, false, 'FEMALE')).toBe(false)
    expect(hasTwoHourPrice({ ...full, guestMalePrice2h: 45000, guestFemalePrice2h: 0 }, false, 'FEMALE')).toBe(true)
    expect(hasTwoHourPrice({ ...full, guestFemalePrice2h: 38000 }, false, 'FEMALE')).toBe(false)
    expect(hasTwoHourPrice({ ...full, memberMalePrice2h: 35000 }, false, 'MALE')).toBe(false)
    expect(hasTwoHourPrice({ ...full, memberMalePrice2h: null }, true, 'MALE')).toBe(false)
  })
})

describe('pricing — giá dự kiến cho người xem', () => {
  it('chỉ Host và FIXED được giá thành viên', () => {
    expect(isMemberTier({ role: 'HOST' })).toBe(true)
    expect(isMemberTier({ role: 'MEMBER', membershipType: 'FIXED' })).toBe(true)
    expect(isMemberTier({ role: 'MEMBER', membershipType: 'PENDING_FIXED' })).toBe(false)
    expect(isMemberTier(null)).toBe(false)
  })

  it('twoHourPrice = null khi hạng không có giá 2h nam', () => {
    expect(computeViewerPricing(full, { role: 'MEMBER', membershipType: 'CASUAL', gender: 'MALE' })).toEqual({
      memberTier: false,
      fullPrice: 60000,
      twoHourPrice: null,
    })
    expect(
      computeViewerPricing({ ...full, memberMalePrice2h: 35000 }, { role: 'MEMBER', membershipType: 'FIXED', gender: 'FEMALE' })
    ).toEqual({ memberTier: true, fullPrice: 40000, twoHourPrice: 40000 })
  })

  it('ưu tiên viewerPricing của server', () => {
    const server = { memberTier: true, fullPrice: 1, twoHourPrice: null }
    expect(resolveViewerPricing({ ...full, guestMalePrice2h: 45000, viewerPricing: server }, null)).toBe(server)
    expect(resolveViewerPricing({ ...full, viewerPricing: null }, null).fullPrice).toBe(60000)
  })

  it('requiresDeposit: ưu tiên cờ server, thiếu thì đoán như cũ', () => {
    const casualNew = { role: 'MEMBER', membershipType: 'CASUAL', sessionsAttended: 0 }
    expect(resolveRequiresDeposit({ depositAmount: 30000, requiresDeposit: false }, casualNew)).toBe(false)
    expect(resolveRequiresDeposit({ depositAmount: 30000, requiresDeposit: true }, { role: 'HOST' })).toBe(true)
    expect(resolveRequiresDeposit({ depositAmount: 30000 }, casualNew)).toBe(true)
    expect(resolveRequiresDeposit({ depositAmount: 30000 }, { ...casualNew, sessionsAttended: 2 })).toBe(false)
    expect(resolveRequiresDeposit({ depositAmount: 30000 }, { role: 'MEMBER', membershipType: 'FIXED' })).toBe(false)
    expect(resolveRequiresDeposit({ depositAmount: 0 }, casualNew)).toBe(false)
  })
})
