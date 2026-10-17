import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HostDashboardView } from '../views/HostDashboardView'
import { ToastProvider } from '../components/ToastProvider'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const hour = 60 * 60 * 1000
const toLocalIso = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}

const participant = (over: Record<string, unknown>) => ({
  sessionId: 1,
  isGuest: false,
  phone: '0900000000',
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
  id: 1,
  title: 'Ca Host Test',
  venueName: 'Sân Test',
  venueAddress: '1 Đường A',
  hostName: 'Host',
  startTime: toLocalIso(Date.now() + 2 * hour),
  endTime: toLocalIso(Date.now() + 4 * hour),
  status: 'UPCOMING',
  maxSlots: 16,
  courtCount: 2,
  courtNames: 'Sân 1, Sân 2',
  bookedSlots: 4,
  checkedInSlots: 2,
  depositAmount: 20000,
  checkinToken: 'TOK123',
  participants: [
    participant({ id: 1, name: 'An' }),
    participant({ id: 2, name: 'Bình' }),
    participant({
      id: 3,
      name: 'Cường',
      checkinStatus: 'CHECKED_IN',
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      remainingAmount: 0,
      canUndoPayment: true,
    }),
    participant({
      id: 4,
      name: 'Dũng',
      checkinStatus: 'CHECKED_IN',
      paymentStatus: 'PAID',
      paymentMethod: 'VIETQR',
      remainingAmount: 0,
      canUndoPayment: false,
    }),
  ],
})

const report = {
  sessionId: 1,
  title: 'Ca Host Test',
  totalPlayers: 4,
  checkedInPlayers: 2,
  paidPlayers: 2,
  unpaidPlayers: 2,
  totalRevenue: 120000,
  totalDepositCollected: 0,
  costCourt: 0,
  costShuttlecock: 0,
  totalExpenses: 0,
  netProfit: 120000,
}

const renderDashboard = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/host/session/1']}>
          <Routes>
            <Route path="/host/session/:id" element={<HostDashboardView />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

const card = async (pid: number) => screen.findByTestId(`roster-card-${pid}`, {}, { timeout: 8000 })

// Màn hình Host khá lớn: khi chạy song song cả bộ test, lần render đầu có thể > 5s
describe('HostDashboardView - thẻ điểm danh trên mobile', { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    ;(api.get as any).mockImplementation((url: string) => {
      if (url === '/sessions/1') return Promise.resolve({ data: buildSession() })
      if (url === '/matches/session/1') return Promise.resolve({ data: [] })
      if (url === '/reports/session/1') return Promise.resolve({ data: report })
      return Promise.resolve({ data: [] })
    })
  })

  it('bấm "Đã đến" gọi manual-checkin và chỉ thẻ đó hiện trạng thái chờ', async () => {
    ;(api.post as any).mockImplementation(() => new Promise(() => {}))
    renderDashboard()

    const anCard = await card(1)
    fireEvent.click(within(anCard).getByRole('button', { name: /Điểm danh An/ }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/sessions/participants/1/manual-checkin'))
    expect(await within(anCard).findByText('Đang lưu...')).toBeInTheDocument()
    expect(within(anCard).getByRole('button', { name: /Điểm danh An/ })).toBeDisabled()

    const binhCard = await card(2)
    const binhToggle = within(binhCard).getByRole('button', { name: /Điểm danh Bình: Chưa đến/ })
    expect(binhToggle).not.toBeDisabled()
    expect(within(binhCard).queryByText('Đang lưu...')).not.toBeInTheDocument()
  })

  it('check-in lỗi thì trả lại trạng thái "Chưa đến" và báo lỗi', async () => {
    ;(api.post as any).mockRejectedValue({ response: { data: { message: 'Ca đã bị khóa!' } } })
    renderDashboard()

    const anCard = await card(1)
    fireEvent.click(within(anCard).getByRole('button', { name: /Điểm danh An/ }))
    expect(await screen.findByText('Ca đã bị khóa!')).toBeInTheDocument()
    await waitFor(() =>
      expect(within(anCard).getByRole('button', { name: /Điểm danh An: Chưa đến/ })).not.toBeDisabled()
    )
  })

  it('"Thu tiền" mở popup thu tiền và gửi settle', async () => {
    ;(api.post as any).mockResolvedValue({ data: {} })
    renderDashboard()

    const anCard = await card(1)
    fireEvent.click(within(anCard).getByRole('button', { name: /Thu tiền/ }))
    const dialog = await screen.findByRole('dialog', { name: /Xác nhận thu tiền sân/ })
    fireEvent.click(within(dialog).getByRole('button', { name: /Tiền mặt/ }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/sessions/participants/settle', { participantId: 1, paymentMethod: 'CASH' })
    )
  })

  it('thu tiền lượt đã thanh toán: hiện lỗi server, không im lặng', async () => {
    ;(api.post as any).mockRejectedValue({ response: { data: { message: 'Lượt này đã thanh toán rồi!' } } })
    renderDashboard()

    fireEvent.click(within(await card(2)).getByRole('button', { name: /Thu tiền/ }))
    const dialog = await screen.findByRole('dialog', { name: /Xác nhận thu tiền sân/ })
    fireEvent.click(within(dialog).getByRole('button', { name: /VietQR/ }))
    expect(await screen.findByText('Lượt này đã thanh toán rồi!')).toBeInTheDocument()
  })

  it('Hoàn tác thu tiền: bắt buộc lý do rồi gọi undo-payment với {reason}', async () => {
    ;(api.post as any).mockResolvedValue({ data: {} })
    renderDashboard()

    fireEvent.click(within(await card(3)).getByRole('button', { name: /Thao tác khác cho Cường/ }))
    const menu = await screen.findByRole('dialog', { name: /Thao tác: Cường/ })
    fireEvent.click(within(menu).getByRole('button', { name: /Hoàn tác thu tiền/ }))

    const sheet = await screen.findByRole('dialog', { name: /Hoàn tác thu tiền: Cường/ })
    const confirm = within(sheet).getByRole('button', { name: /Xác nhận hoàn tác/ })
    expect(confirm).toBeDisabled()

    fireEvent.click(within(sheet).getByRole('button', { name: 'Bấm nhầm' }))
    expect(confirm).not.toBeDisabled()
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/sessions/participants/3/undo-payment', { reason: 'Bấm nhầm' })
    )
  })

  it('Hoàn tác thu tiền quá hạn: hiện thông báo lỗi từ server', async () => {
    ;(api.post as any).mockRejectedValue({
      response: { data: { message: 'Chỉ hoàn tác được trong 7 ngày sau khi ca kết thúc!' } },
    })
    renderDashboard()

    fireEvent.click(within(await card(3)).getByRole('button', { name: /Thao tác khác cho Cường/ }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: /Thao tác: Cường/ })).getByRole('button', { name: /Hoàn tác thu tiền/ }))
    const sheet = await screen.findByRole('dialog', { name: /Hoàn tác thu tiền: Cường/ })
    fireEvent.change(within(sheet).getByLabelText(/Hoặc nhập lý do khác/), { target: { value: 'Khách đổi ý' } })
    fireEvent.click(within(sheet).getByRole('button', { name: /Xác nhận hoàn tác/ }))

    expect(await screen.findByText('Chỉ hoàn tác được trong 7 ngày sau khi ca kết thúc!')).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/sessions/participants/3/undo-payment', { reason: 'Khách đổi ý' })
  })

  it('menu ẩn "Hoàn tác thu tiền" khi canUndoPayment=false; Xóa & Sửa hóa đơn bị khóa với lượt đã thanh toán', async () => {
    renderDashboard()

    fireEvent.click(within(await card(4)).getByRole('button', { name: /Thao tác khác cho Dũng/ }))
    const menu = await screen.findByRole('dialog', { name: /Thao tác: Dũng/ })
    expect(within(menu).queryByRole('button', { name: /Hoàn tác thu tiền/ })).not.toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /Xóa khỏi ca/ })).toBeDisabled()
    expect(within(menu).getByRole('button', { name: /Sửa hóa đơn/ })).toBeDisabled()
    expect(within(menu).getByText(/hoàn tác thu tiền trước khi xóa/)).toBeInTheDocument()

    // "Xóa khỏi ca" luôn là thao tác cuối cùng
    const buttons = within(menu).getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Đóng')
    expect(buttons[buttons.length - 1]).toHaveTextContent(/Xóa khỏi ca/)
  })

  it('Hủy điểm danh dùng BottomSheet xác nhận (không dùng window.confirm)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    ;(api.post as any).mockResolvedValue({ data: { notes: [] } })
    renderDashboard()

    fireEvent.click(within(await card(3)).getByRole('button', { name: /Thao tác khác cho Cường/ }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: /Thao tác: Cường/ })).getByRole('button', { name: /Hủy điểm danh/ }))
    const sheet = await screen.findByRole('dialog', { name: /Hủy điểm danh: Cường/ })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Hủy điểm danh' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/sessions/participants/3/cancel-checkin'))
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('lọc "Chưa đến" chỉ hiện người chưa điểm danh', async () => {
    renderDashboard()
    await card(1)
    fireEvent.click(screen.getByRole('button', { name: 'Chưa đến (2)' }))
    const cards = within(screen.getByTestId('roster-cards'))
    expect(cards.queryByTestId('roster-card-3')).not.toBeInTheDocument()
    expect(cards.getByTestId('roster-card-1')).toBeInTheDocument()
  })

  it('ghi người thắng xong có nút "Hoàn tác" gọi DELETE /matches/{id} của trận vừa ghi', async () => {
    localStorage.setItem(
      'smashflow_drafts_1',
      JSON.stringify({ 'Sân 1': { teamAP1: '1', teamAP2: '', teamBP1: '2', teamBP2: '' } })
    )
    ;(api.post as any).mockImplementation((url: string) =>
      url === '/matches' ? Promise.resolve({ data: { id: 55 } }) : Promise.resolve({ data: {} })
    )
    ;(api.delete as any).mockResolvedValue({ data: {} })
    renderDashboard()

    fireEvent.click(await screen.findByRole('tab', { name: /Trận đấu/ }))
    fireEvent.click(screen.getByRole('button', { name: /Team Blue thắng/ }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/matches',
        expect.objectContaining({ teamAPlayer1Id: 1, teamBPlayer1Id: 2, winningTeam: 'A', courtName: 'Sân 1' })
      )
    )
    const undo = await screen.findByRole('button', { name: /^Hoàn tác$/ })
    fireEvent.click(undo)
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/matches/55'))
  })

  it('mã QR ghi đúng cửa sổ tự điểm danh 30 phút trước giờ bắt đầu', async () => {
    renderDashboard()
    expect(await screen.findByText(/Thành viên tự điểm danh từ 30 phút trước giờ bắt đầu đến hết ca/)).toBeInTheDocument()
    expect(screen.queryByText(/15 phút/)).not.toBeInTheDocument()
  })
})
