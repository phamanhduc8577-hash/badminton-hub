import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
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
/** Giờ server = giờ Việt Nam không kèm múi giờ */
const toVnIso = (ms: number) => new Date(ms + 7 * hour).toISOString().slice(0, 19)

const casual = { id: 7, fullName: 'Khách', phone: '0900000007', role: 'MEMBER', gender: 'MALE', membershipType: 'CASUAL', sessionsAttended: 3 }

const buildSession = (over: Record<string, unknown> = {}) => ({
  id: 5,
  title: 'Ca Đợt 5',
  venueName: 'Sân Test',
  venueAddress: '1 Đường A',
  hostName: 'Host',
  startTime: toVnIso(Date.now() + 2 * hour),
  endTime: toVnIso(Date.now() + 5 * hour), // ca 3 tiếng → có lựa chọn khung giờ
  status: 'UPCOMING',
  maxSlots: 16,
  bookedSlots: 1,
  memberMalePrice: 50000,
  memberFemalePrice: 40000,
  guestMalePrice: 60000,
  guestFemalePrice: 50000,
  depositAmount: 20000,
  participants: [],
  ...over,
})

const myParticipant = {
  id: 101,
  sessionId: 5,
  userId: 7,
  name: 'Khách',
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
}

const LocationProbe = () => {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

const mockGet = (sessionResponse: () => Promise<unknown>) => {
  ;(api.get as any).mockImplementation((url: string) => {
    if (url === '/sessions/5') return sessionResponse()
    if (url === '/matches/session/5') return Promise.resolve({ data: [] })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
}

const renderView = (entry = '/sessions/5') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route
              path="/sessions/:id"
              element={
                <>
                  <SessionDetailView />
                  <LocationProbe />
                </>
              }
            />
            <Route path="/" element={<div>Trang chủ</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
  return { ...utils, queryClient }
}

describe('SessionDetailView — giá dự kiến (5.5) & tiền cọc (5.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth(casual as any, 'tok')
  })

  it('popup khung giờ hiển thị đúng giá viewerPricing của server', async () => {
    mockGet(() =>
      Promise.resolve({
        data: buildSession({
          guestMalePrice2h: 99999, // server đã tính sẵn → không dùng giá thô
          viewerPricing: { memberTier: false, fullPrice: 65000, twoHourPrice: 42000 },
        }),
      })
    )
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: /Đăng ký tham gia/ }))
    const dialog = await screen.findByRole('dialog', { name: /Chọn Khung Giờ Đánh/ })
    const options = within(dialog).getAllByRole('radio')
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent('65.000đ')
    expect(options[1]).toHaveTextContent('42.000đ')
    expect(options[2]).toHaveTextContent('42.000đ')
    expect(dialog).not.toHaveTextContent('99.999đ')
    expect(options[0]).toHaveTextContent('Giá Vãng lai')
  })

  it('twoHourPrice = null: ẩn khung 2 tiếng, bấm đăng ký là tham gia full ca luôn', async () => {
    mockGet(() =>
      Promise.resolve({ data: buildSession({ viewerPricing: { memberTier: false, fullPrice: 65000, twoHourPrice: null } }) })
    )
    ;(api.post as any).mockResolvedValue({ data: { ...myParticipant, depositAmount: 0 } })
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: /Đăng ký tham gia/ }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/sessions/5/join', { durationHours: undefined, slotWindow: undefined }))
    expect(screen.queryByRole('dialog', { name: /Chọn Khung Giờ Đánh/ })).not.toBeInTheDocument()
  })

  it('không có viewerPricing (backend cũ): tự tính như PricingCalculator — thiếu giá 2h nam thì không có gói 2h', async () => {
    ;(api.post as any).mockResolvedValue({ data: { ...myParticipant } })
    mockGet(() => Promise.resolve({ data: buildSession({ guestFemalePrice2h: 38000 }) }))
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: /Đăng ký tham gia/ }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/sessions/5/join', expect.anything()))
    expect(screen.queryByRole('dialog', { name: /Chọn Khung Giờ Đánh/ })).not.toBeInTheDocument()
  })

  it('không có viewerPricing: có giá 2h nam → hiện gói 2h với giá đó (giá 0 vẫn hợp lệ)', async () => {
    mockGet(() => Promise.resolve({ data: buildSession({ guestMalePrice2h: 0 }) }))
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: /Đăng ký tham gia/ }))
    const dialog = await screen.findByRole('dialog', { name: /Chọn Khung Giờ Đánh/ })
    const options = within(dialog).getAllByRole('radio')
    expect(options[0]).toHaveTextContent('60.000đ')
    expect(within(options[1]).getByText('0đ')).toBeInTheDocument()
  })

  it('nhãn cọc dùng session.depositAmount (không còn 20.000đ viết cứng)', async () => {
    useAuthStore.getState().setAuth({ ...casual, sessionsAttended: 0 } as any, 'tok')
    mockGet(() => Promise.resolve({ data: buildSession({ depositAmount: 30000 }) }))
    renderView()
    expect(await screen.findByRole('button', { name: /Khách vãng lai - Cọc 30\.000đ/ })).toBeInTheDocument()
    expect(screen.getByText(/Cọc 30\.000đ \(lần đầu\)/)).toBeInTheDocument()
    expect(screen.queryByText(/20\.000đ/)).not.toBeInTheDocument()
  })

  it('requiresDeposit=false của server thắng cách đoán theo số buổi', async () => {
    useAuthStore.getState().setAuth({ ...casual, sessionsAttended: 0 } as any, 'tok')
    mockGet(() => Promise.resolve({ data: buildSession({ depositAmount: 30000, requiresDeposit: false }) }))
    renderView()
    expect(await screen.findByRole('button', { name: /Miễn cọc/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cọc 30\.000đ/ })).not.toBeInTheDocument()
  })

  it('popup cọc VietQR ghi đúng số tiền cọc của lượt đăng ký', async () => {
    useAuthStore.getState().setAuth({ ...casual, sessionsAttended: 0 } as any, 'tok')
    mockGet(() => Promise.resolve({ data: buildSession({ depositAmount: 30000, viewerPricing: { memberTier: false, fullPrice: 60000, twoHourPrice: null } }) }))
    ;(api.post as any).mockResolvedValue({ data: { ...myParticipant, depositAmount: 30000, depositStatus: 'PENDING' } })
    ;(api.get as any).mockImplementation((url: string) => {
      if (url === '/sessions/5') return Promise.resolve({ data: buildSession({ depositAmount: 30000, viewerPricing: { memberTier: false, fullPrice: 60000, twoHourPrice: null } }) })
      if (url === '/matches/session/5') return Promise.resolve({ data: [] })
      if (url === '/sessions/participants/101/deposit-qr') return Promise.resolve({ data: { qrUrl: 'https://qr.example/x.png' } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: /Đăng ký tham gia/ }))
    const dialog = await screen.findByRole('dialog', { name: /Quét VietQR cọc giữ chỗ/ })
    expect(within(dialog).getAllByText(/30\.000đ/).length).toBeGreaterThanOrEqual(2)
    expect(dialog).not.toHaveTextContent(/20k|20\.000/)
  })
})

describe('SessionDetailView — ca hủy / kết thúc (5.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth(casual as any, 'tok')
  })

  it('ca đã hủy (effectiveStatus): ẩn nút tham gia, báo "Ca đã bị hủy"', async () => {
    mockGet(() => Promise.resolve({ data: buildSession({ status: 'CANCELLED', effectiveStatus: 'CANCELLED' }) }))
    renderView()
    expect(await screen.findByTestId('session-closed-notice')).toHaveTextContent('Ca đã bị hủy')
    expect(screen.queryByRole('button', { name: /Đăng ký tham gia/ })).not.toBeInTheDocument()
  })

  it('server báo COMPLETED dù giờ máy chưa tới → "Ca đã kết thúc"', async () => {
    mockGet(() => Promise.resolve({ data: buildSession({ effectiveStatus: 'COMPLETED' }) }))
    renderView()
    expect(await screen.findByTestId('session-closed-notice')).toHaveTextContent('Ca đã kết thúc')
    expect(screen.queryByRole('button', { name: /Đăng ký tham gia/ })).not.toBeInTheDocument()
  })
})

describe('SessionDetailView — lỗi tải ca (5.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth(casual as any, 'tok')
  })

  it('lỗi mạng: hiện thẻ lỗi + "Thử lại" tải lại được', async () => {
    let fail = true
    mockGet(() =>
      fail
        ? Promise.reject({ response: { status: 500, data: { message: 'Máy chủ đang bảo trì!' } } })
        : Promise.resolve({ data: buildSession() })
    )
    renderView()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Không tải được thông tin ca đánh')
    expect(alert).toHaveTextContent('Máy chủ đang bảo trì!')
    expect(screen.queryByText(/Đang tải thông tin/)).not.toBeInTheDocument()

    fail = false
    fireEvent.click(within(alert).getByRole('button', { name: /Thử lại/ }))
    expect(await screen.findByText('Ca Đợt 5')).toBeInTheDocument()
  })

  it('404: "Không tìm thấy ca đánh" + nút quay lại danh sách', async () => {
    mockGet(() => Promise.reject({ response: { status: 404, data: { message: 'Not found' } } }))
    renderView()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Không tìm thấy ca đánh')
    expect(within(alert).queryByRole('button', { name: /Thử lại/ })).not.toBeInTheDocument()
    fireEvent.click(within(alert).getByRole('button', { name: /Quay lại danh sách ca/ }))
    expect(await screen.findByText('Trang chủ')).toBeInTheDocument()
  })
})

describe('SessionDetailView — link QR ?token= (5.8)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth(casual as any, 'tok')
  })

  it('xử lý 1 lần: tự điểm danh, xóa ?token= khỏi URL, tải lại dữ liệu không mở lại popup', async () => {
    mockGet(() => Promise.resolve({ data: buildSession({ participants: [myParticipant] }) }))
    ;(api.post as any).mockResolvedValue({ data: {} })
    const { queryClient } = renderView('/sessions/5?token=abcd1234&ref=zalo')

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/sessions/5/checkin', { token: 'ABCD1234', durationHours: undefined })
    )
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/sessions/5?ref=zalo'))

    const dialog = await screen.findByRole('dialog', { name: /Điểm danh 1-Chạm/ })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Xác nhận$/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Điểm danh 1-Chạm/ })).not.toBeInTheDocument())

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['session', '5'] })
    })
    expect(screen.queryByRole('dialog', { name: /Điểm danh 1-Chạm/ })).not.toBeInTheDocument()
    expect((api.post as any).mock.calls.filter((c: unknown[]) => c[0] === '/sessions/5/checkin')).toHaveLength(1)
  })

  it('điểm danh xong làm mới danh sách ca, hồ sơ, phần thưởng, lịch sử điểm danh (5.10)', async () => {
    mockGet(() => Promise.resolve({ data: buildSession({ participants: [myParticipant] }) }))
    ;(api.post as any).mockResolvedValue({ data: {} })
    const { queryClient } = renderView('/sessions/5?token=abcd1234')
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/sessions/5/checkin', expect.anything()))
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as any).queryKey))
      for (const k of ['["session","5"]', '["sessions"]', '["my-profile"]', '["loyalty-rewards"]', '["attendance-history"]']) {
        expect(keys).toContain(k)
      }
    })
  })
})
