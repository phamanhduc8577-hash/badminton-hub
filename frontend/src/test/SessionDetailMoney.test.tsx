import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionDetailView } from '../views/SessionDetailView'
import { ToastProvider } from '../components/ToastProvider'
import { useAuthStore } from '../store/useAuthStore'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

vi.mock('../components/QrCameraScanner', () => ({ QrCameraScanner: () => null }))

const hour = 60 * 60 * 1000
const toLocalIso = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}

const me = { id: 7, fullName: 'Thành Viên', phone: '0900000007', role: 'MEMBER', gender: 'MALE', membershipType: 'CASUAL', sessionsAttended: 3 }

const buildSession = (mine: Record<string, unknown>, sessionOver: Record<string, unknown> = {}) => ({
  id: 5,
  title: 'Ca Tiền Test',
  venueName: 'Sân Test',
  venueAddress: '1 Đường A',
  hostName: 'Host',
  startTime: toLocalIso(Date.now() - 0.5 * hour),
  endTime: toLocalIso(Date.now() + 2.5 * hour),
  status: 'ACTIVE',
  maxSlots: 16,
  bookedSlots: 1,
  memberMalePrice: 50000,
  memberFemalePrice: 40000,
  guestMalePrice: 60000,
  guestFemalePrice: 50000,
  depositAmount: 20000,
  ...sessionOver,
  participants: [
    {
      id: 101,
      sessionId: 5,
      userId: 7,
      name: 'Thành Viên',
      phone: '0900000007',
      isGuest: true,
      gender: 'MALE',
      checkinStatus: 'PENDING',
      depositStatus: 'NONE',
      depositAmount: 0,
      baseFee: 60000,
      adjustmentAmount: 0,
      finalFee: 60000,
      remainingAmount: 60000,
      paymentStatus: 'UNPAID',
      ...mine,
    },
  ],
})

const renderWith = (session: unknown) => {
  ;(api.get as any).mockImplementation((url: string) => {
    if (url === '/sessions/5') return Promise.resolve({ data: session })
    if (url === '/matches/session/5') return Promise.resolve({ data: [] })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/sessions/5']}>
          <Routes>
            <Route path="/sessions/:id" element={<SessionDetailView />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

const openManualCheckin = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /Nhập mã Token/i }))
  return screen.findByRole('dialog', { name: /Điểm danh 1-Chạm/i })
}

describe('SessionDetailView - tiền & điểm danh 2h (đợt 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth(me as any, 'tok')
  })

  it('ẩn lựa chọn "Chỉ đánh 2 Tiếng" khi ca không có giá 2h', async () => {
    renderWith(buildSession({}))
    const dialog = await openManualCheckin()
    expect(within(dialog).queryByRole('button', { name: /Chỉ đánh 2 Tiếng/i })).not.toBeInTheDocument()
  })

  it('ẩn lựa chọn 2h khi ca chỉ có giá 2h của hạng khác (thành viên) mà mình là vãng lai', async () => {
    renderWith(buildSession({}, { memberMalePrice2h: 35000, memberFemalePrice2h: 30000 }))
    const dialog = await openManualCheckin()
    expect(within(dialog).queryByRole('button', { name: /Chỉ đánh 2 Tiếng/i })).not.toBeInTheDocument()
  })

  it('hiện lựa chọn 2h khi ca có giá 2h đúng hạng và gửi durationHours=2', async () => {
    ;(api.post as any).mockResolvedValue({ data: {} })
    renderWith(buildSession({}, { guestMalePrice2h: 45000, guestFemalePrice2h: 38000 }))
    const dialog = await openManualCheckin()
    fireEvent.click(within(dialog).getByRole('button', { name: /Chỉ đánh 2 Tiếng/i }))
    fireEvent.change(within(dialog).getByLabelText(/Mã Token/i), { target: { value: 'abcd1234' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Xác nhận$/ }))
    expect(api.post).toHaveBeenCalledWith('/sessions/5/checkin', { token: 'ABCD1234', durationHours: 2 })
  })

  it('cọc chưa được Host xác nhận: KHÔNG hiện dòng khấu trừ cọc, tiền thu theo remainingAmount từ server', async () => {
    renderWith(buildSession({ depositStatus: 'PENDING', depositAmount: 20000, remainingAmount: 60000 }))
    expect(await screen.findByText('Ca Tiền Test')).toBeInTheDocument()
    expect(screen.queryByText(/Đã cọc giữ chỗ \(Khấu trừ\)/)).not.toBeInTheDocument()
    expect(screen.getByText(/^Thu: 60[.,]000đ$/)).toBeInTheDocument()
  })

  it('cọc đã PAID: hiện dòng khấu trừ và số tiền còn lại do server trả', async () => {
    renderWith(buildSession({ depositStatus: 'PAID', depositAmount: 20000, remainingAmount: 40000 }))
    expect(await screen.findByText(/Đã cọc giữ chỗ \(Khấu trừ\)/)).toBeInTheDocument()
    expect(screen.getByText('- 20.000đ')).toBeInTheDocument()
    expect(screen.getAllByText('40.000đ').length).toBeGreaterThan(0)
  })
})
