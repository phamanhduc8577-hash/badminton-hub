import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionListView } from '../views/SessionListView'
import { ToastProvider } from '../components/ToastProvider'
import { useAuthStore } from '../store/useAuthStore'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const hour = 60 * 60 * 1000
const toVnIso = (ms: number) => new Date(ms + 7 * hour).toISOString().slice(0, 19)

const session = {
  id: 1,
  title: 'Ca Sửa Giá',
  venueName: 'Sân A',
  venueAddress: '1 Đường A',
  hostName: 'Host',
  startTime: toVnIso(Date.now() + 24 * hour),
  endTime: toVnIso(Date.now() + 27 * hour),
  status: 'UPCOMING',
  bookedSlots: 2,
  maxSlots: 16,
  courtNames: 'Sân 1, Sân 2',
  memberMalePrice: 50000,
  memberFemalePrice: 40000,
  guestMalePrice: 60000,
  guestFemalePrice: 50000,
  memberMalePrice2h: 35000,
  memberFemalePrice2h: 31000,
  guestMalePrice2h: 45000,
  guestFemalePrice2h: 38000,
  depositAmount: 20000,
  costCourt: 0,
  costShuttlecock: 0,
}

const renderList = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <SessionListView />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
  return { ...utils, client }
}

const openEditor = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /Sửa ca/ }))
  await screen.findByText('Chỉnh sửa thông tin ca đánh')
}

const clear = (display: string) => fireEvent.change(screen.getByDisplayValue(display), { target: { value: '' } })

describe('SessionListView — sửa nhanh ca: giá 2h & làm mới dữ liệu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth({ id: 1, fullName: 'Host', phone: '1', role: 'HOST', gender: 'MALE' } as any, 'tok')
    ;(api.get as any).mockResolvedValue({ data: [session] })
    ;(api.put as any).mockResolvedValue({ data: session })
  })

  it('ô datetime-local hiển thị đúng giờ VN của ca', async () => {
    renderList()
    await openEditor()
    expect(screen.getByDisplayValue(session.startTime.slice(0, 16))).toBeInTheDocument()
  })

  it('xóa trống cả 4 ô giá 2h → gửi clearTwoHourPrices: true', async () => {
    const { client } = renderList()
    const spy = vi.spyOn(client, 'invalidateQueries')
    await openEditor()
    clear('35.000')
    clear('31.000')
    clear('45.000')
    clear('38.000')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cập nhật' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
    const [url, payload] = (api.put as any).mock.calls[0]
    expect(url).toBe('/sessions/1')
    expect(payload).toMatchObject({
      clearTwoHourPrices: true,
      memberMalePrice2h: null,
      memberFemalePrice2h: null,
      guestMalePrice2h: null,
      guestFemalePrice2h: null,
    })
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as any).queryKey))
      expect(keys).toEqual(expect.arrayContaining(['["sessions"]', '["session","1"]', '["report","1"]']))
    })
  })

  it('giữ nguyên giá 2h → gửi đúng số, không có clearTwoHourPrices', async () => {
    renderList()
    await openEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cập nhật' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
    const payload = (api.put as any).mock.calls[0][1]
    expect(payload).toMatchObject({ memberMalePrice2h: 35000, memberFemalePrice2h: 31000, guestMalePrice2h: 45000, guestFemalePrice2h: 38000 })
    expect(payload).not.toHaveProperty('clearTwoHourPrices')
  })

  it('chỉ xóa 1 ô đã có giá → báo lỗi, không gửi (server hiểu null = giữ nguyên)', async () => {
    renderList()
    await openEditor()
    clear('31.000')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cập nhật' }))
    expect(await screen.findByText(/xóa trống cả 4 ô giá 2 tiếng/)).toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
  })
})
