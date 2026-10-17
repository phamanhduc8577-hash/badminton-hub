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
const toVnIso = (ms: number) => new Date(ms + 7 * hour).toISOString().slice(0, 19)

const buildSession = (over: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'Ca Hủy Test',
  venueName: 'Sân Test',
  venueAddress: '1 Đường A',
  hostName: 'Host',
  startTime: toVnIso(Date.now() + 2 * hour),
  endTime: toVnIso(Date.now() + 4 * hour),
  status: 'UPCOMING',
  maxSlots: 16,
  courtCount: 2,
  courtNames: 'Sân 1, Sân 2',
  bookedSlots: 0,
  checkedInSlots: 0,
  depositAmount: 20000,
  checkinToken: 'TOK123',
  participants: [],
  ...over,
})

const renderDashboard = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/host/session/1']}>
          <Routes>
            <Route path="/host/session/:id" element={<HostDashboardView />} />
            <Route path="/host" element={<div>Tổng quan Host</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
  return { ...utils, client }
}

const mockGet = (session: () => Promise<unknown>) => {
  ;(api.get as any).mockImplementation((url: string) => {
    if (url === '/sessions/1') return session()
    if (url === '/matches/session/1') return Promise.resolve({ data: [] })
    if (url === '/reports/session/1') return Promise.resolve({ data: { totalRevenue: 0 } })
    return Promise.resolve({ data: [] })
  })
}

describe('HostDashboardView — đợt 5', { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('lỗi tải ca: thẻ lỗi + "Thử lại" (không "Đang tải" mãi)', async () => {
    let fail = true
    mockGet(() =>
      fail ? Promise.reject({ response: { status: 503, data: { message: 'Máy chủ quá tải!' } } }) : Promise.resolve({ data: buildSession() })
    )
    renderDashboard()
    const alert = await screen.findByRole('alert', {}, { timeout: 8000 })
    expect(alert).toHaveTextContent('Máy chủ quá tải!')
    expect(screen.queryByText(/Đang tải trung tâm điều khiển Host/)).not.toBeInTheDocument()

    fail = false
    fireEvent.click(within(alert).getByRole('button', { name: /Thử lại/ }))
    expect(await screen.findByRole('heading', { name: 'Ca Hủy Test' }, { timeout: 8000 })).toBeInTheDocument()
  })

  it('404: "Không tìm thấy ca đánh", không có nút thử lại', async () => {
    mockGet(() => Promise.reject({ response: { status: 404, data: {} } }))
    renderDashboard()
    const alert = await screen.findByRole('alert', {}, { timeout: 8000 })
    expect(alert).toHaveTextContent('Không tìm thấy ca đánh')
    expect(within(alert).queryByRole('button', { name: /Thử lại/ })).not.toBeInTheDocument()
  })

  it('Hủy ca: gửi lý do, thành công thì báo + làm mới ca / danh sách ca / báo cáo', async () => {
    mockGet(() => Promise.resolve({ data: buildSession() }))
    ;(api.post as any).mockResolvedValue({ data: buildSession({ status: 'CANCELLED', effectiveStatus: 'CANCELLED' }) })
    const { client } = renderDashboard()
    const spy = vi.spyOn(client, 'invalidateQueries')

    fireEvent.click(await screen.findByRole('button', { name: 'Hủy ca' }, { timeout: 8000 }))
    const sheet = await screen.findByRole('dialog', { name: /Hủy ca: Ca Hủy Test/ })
    const reason = within(sheet).getByLabelText(/Lý do hủy/)
    expect(reason.className).toMatch(/text-base/)
    fireEvent.change(reason, { target: { value: 'Sân bảo trì' } })
    const confirm = within(sheet).getByRole('button', { name: 'Xác nhận hủy ca' })
    expect(confirm.className).toMatch(/bg-rose-600/)
    fireEvent.click(confirm)

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/sessions/1/cancel', { reason: 'Sân bảo trì' }))
    expect(await screen.findByText(/Đã hủy ca/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Hủy ca:/ })).not.toBeInTheDocument())
    const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as any).queryKey))
    expect(keys).toEqual(expect.arrayContaining(['["session","1"]', '["sessions"]', '["report","1"]']))
  })

  it('Hủy ca lỗi: hiện đúng thông báo server trong popup, popup vẫn mở', async () => {
    mockGet(() => Promise.resolve({ data: buildSession() }))
    ;(api.post as any).mockRejectedValue({
      response: { status: 400, data: { message: 'Ca đã có người thanh toán, vui lòng hoàn tác thu tiền trước khi hủy ca!' } },
    })
    renderDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy ca' }, { timeout: 8000 }))
    const sheet = await screen.findByRole('dialog', { name: /Hủy ca: Ca Hủy Test/ })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Xác nhận hủy ca' }))

    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      'Ca đã có người thanh toán, vui lòng hoàn tác thu tiền trước khi hủy ca!'
    )
    expect(api.post).toHaveBeenCalledWith('/sessions/1/cancel', {})
    expect(screen.getByRole('dialog', { name: /Hủy ca: Ca Hủy Test/ })).toBeInTheDocument()
  })

  it('ca đã hủy: hiện trạng thái "Đã hủy", ẩn nút "Hủy ca"', async () => {
    mockGet(() => Promise.resolve({ data: buildSession({ status: 'CANCELLED', effectiveStatus: 'CANCELLED' }) }))
    renderDashboard()
    expect(await screen.findByTestId('host-session-status', {}, { timeout: 8000 })).toHaveTextContent('Đã hủy')
    expect(screen.getByText(/Ca này đã bị hủy/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hủy ca' })).not.toBeInTheDocument()
  })

  it('ca đã kết thúc: ẩn nút "Hủy ca"', async () => {
    mockGet(() => Promise.resolve({ data: buildSession({ effectiveStatus: 'COMPLETED' }) }))
    renderDashboard()
    expect(await screen.findByTestId('host-session-status', {}, { timeout: 8000 })).toHaveTextContent('Đã kết thúc')
    expect(screen.queryByRole('button', { name: 'Hủy ca' })).not.toBeInTheDocument()
  })
})
