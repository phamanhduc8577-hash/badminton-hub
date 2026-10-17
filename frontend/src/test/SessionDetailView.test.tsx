import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
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

// Thay máy quét camera thật (html5-qrcode cần camera) bằng nút giả lập kết quả quét
vi.mock('../components/QrCameraScanner', async () => {
  const R = await vi.importActual<typeof import('react')>('react')
  return {
    QrCameraScanner: (props: { onScanSuccess: (t: string) => void; onManualEntry?: () => void }) =>
      R.createElement(
        'div',
        { 'data-testid': 'mock-scanner' },
        R.createElement('button', { onClick: () => props.onScanSuccess('https://smashflow.app/sessions/5?token=badtok12') }, 'mock-scan'),
        R.createElement('button', { onClick: () => props.onManualEntry?.() }, 'mock-manual')
      ),
  }
})

const hour = 60 * 60 * 1000
const toLocalIso = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}

const me = { id: 7, fullName: 'Thành Viên', phone: '0900000007', role: 'MEMBER', gender: 'MALE', membershipType: 'CASUAL', sessionsAttended: 3 }

const participant = (over: Record<string, unknown>) => ({
  sessionId: 5,
  isGuest: false,
  gender: 'MALE',
  checkinStatus: 'PENDING',
  depositStatus: 'NONE',
  depositAmount: 0,
  baseFee: 60000,
  adjustmentAmount: 0,
  finalFee: 60000,
  remainingAmount: 60000,
  paymentStatus: 'UNPAID',
  ...over,
})

const buildSession = () => ({
  id: 5,
  title: 'Ca Tối Test',
  venueName: 'Sân Test',
  venueAddress: '1 Đường A',
  hostName: 'Host',
  startTime: toLocalIso(Date.now() + 2 * hour),
  endTime: toLocalIso(Date.now() + 4 * hour),
  status: 'ACTIVE', // server ghi sai: theo giờ thực tế ca vẫn "Sắp diễn ra"
  maxSlots: 16,
  bookedSlots: 3,
  memberMalePrice: 60000,
  memberFemalePrice: 50000,
  guestMalePrice: 70000,
  guestFemalePrice: 60000,
  depositAmount: 20000,
  participants: [
    participant({ id: 101, userId: 7, name: 'Thành Viên', phone: '0900000007' }),
    participant({ id: 102, userId: 8, name: 'Người Che Sẵn', phone: '0912***678' }),
    participant({ id: 103, userId: 9, name: 'Không Có SĐT', phone: 'N/A' }),
  ],
})

const renderView = () => {
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

const rejectWith = (message: string) => ({ response: { status: 400, data: { message } } })

describe('SessionDetailView - mobile cho thành viên', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth(me as any, 'tok')
    ;(api.get as any).mockImplementation((url: string) => {
      if (url === '/sessions/5') return Promise.resolve({ data: buildSession() })
      if (url === '/matches/session/5') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  })

  it('trạng thái ca tính theo giờ thực tế (giống trang danh sách), không theo status server', async () => {
    renderView()
    expect(await screen.findByText('Ca Tối Test')).toBeInTheDocument()
    expect(screen.getByText('Sắp diễn ra')).toBeInTheDocument()
    expect(screen.queryByText(/Đang diễn ra/)).not.toBeInTheDocument()
  })

  it('SĐT đã che sẵn từ server hiển thị nguyên; SĐT thiếu thì ẩn, không có "N/A***N/A"', async () => {
    renderView()
    await screen.findByText('Ca Tối Test')
    expect(screen.getByText('0912***678')).toBeInTheDocument()
    expect(screen.queryByText(/N\/A/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\*\*\*\*/)).not.toBeInTheDocument()
  })

  it('quét QR lỗi: hiện toast lỗi VÀ mở form nhập mã tay kèm lý do, đã điền sẵn mã', async () => {
    ;(api.post as any).mockRejectedValue(rejectWith('Mã điểm danh không đúng hoặc đã hết hạn!'))
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: /Quét QR sân/i }))
    fireEvent.click(screen.getByRole('button', { name: 'mock-scan' }))

    const dialog = await screen.findByRole('dialog', { name: /Điểm danh 1-Chạm/i })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Mã điểm danh không đúng hoặc đã hết hạn!')
    expect(within(dialog).getByLabelText(/Mã Token/i)).toHaveValue('BADTOK12')
    // Toast nằm trong vùng aria-live
    expect(within(screen.getByRole('status')).getByText('Mã điểm danh không đúng hoặc đã hết hạn!')).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/sessions/5/checkin', { token: 'BADTOK12', durationHours: undefined })
  })

  it('nút "Nhập mã bằng tay" trong máy quét mở thẳng form nhập tay', async () => {
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: /Quét QR sân/i }))
    fireEvent.click(screen.getByRole('button', { name: 'mock-manual' }))
    expect(screen.queryByTestId('mock-scanner')).not.toBeInTheDocument()
    const dialog = await screen.findByRole('dialog', { name: /Điểm danh 1-Chạm/i })
    const input = within(dialog).getByLabelText(/Mã Token/i)
    expect(input).toHaveAttribute('autocapitalize', 'characters')
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('spellcheck', 'false')
  })

  it('tiền mặt: khóa cả 2 nút khi đang chờ; API lỗi thì KHÔNG báo "Host đã ghi nhận" mà hiện toast lỗi', async () => {
    let rejectSelect: (e: unknown) => void = () => {}
    ;(api.post as any).mockImplementation(
      () => new Promise((_resolve, reject) => { rejectSelect = reject })
    )
    renderView()
    const cashBtn = await screen.findByRole('button', { name: /Trả Tiền mặt cho Host/i })
    const qrBtn = screen.getByRole('button', { name: /Quét VietQR chuyển khoản/i })

    fireEvent.click(cashBtn)
    expect(cashBtn).toBeDisabled()
    expect(qrBtn).toBeDisabled()
    expect(cashBtn).toHaveTextContent('Đang gửi cho Host...')

    // Bấm thêm lần nữa khi đang chờ không gửi thêm request
    fireEvent.click(cashBtn)
    expect(api.post).toHaveBeenCalledTimes(1)

    await act(async () => {
      rejectSelect(rejectWith('Máy chủ đang bận, thử lại sau!'))
    })

    expect(await screen.findByText('Máy chủ đang bận, thử lại sau!')).toBeInTheDocument()
    expect(screen.queryByText(/Host đã ghi nhận hình thức Tiền mặt/i)).not.toBeInTheDocument()
    await waitFor(() => expect(cashBtn).not.toBeDisabled())
    expect(qrBtn).not.toBeDisabled()
  })

  it('tiền mặt: chỉ hiện thông báo sau khi API thành công', async () => {
    ;(api.post as any).mockResolvedValue({ data: {} })
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: /Trả Tiền mặt cho Host/i }))
    expect(await screen.findByRole('dialog', { name: /Host đã ghi nhận hình thức Tiền mặt/i })).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/sessions/participants/101/select-payment-method', { paymentMethod: 'CASH' })
  })

  it('VietQR: lỗi ghi nhận hình thức thanh toán thì báo lỗi, không mở mã QR', async () => {
    ;(api.post as any).mockRejectedValue(rejectWith('Không ghi nhận được hình thức thanh toán!'))
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: /Quét VietQR chuyển khoản/i }))
    expect(await screen.findByText('Không ghi nhận được hình thức thanh toán!')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Quét VietQR thanh toán/i })).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalledWith('/sessions/participants/101/payment-qr')
  })
})
