import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionListView } from '../views/SessionListView'
import { useAuthStore } from '../store/useAuthStore'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockSessions = [
  {
    id: 1,
    title: 'Ca Tối Thứ 6 (Đang diễn ra)',
    venueName: 'Sân Đại Phát',
    venueAddress: '123 Đường A',
    hostName: 'AnhDuck',
    startTime: '2026-09-15T15:00:00Z',
    endTime: '2026-09-15T18:00:00Z', // Active window
    status: 'ACTIVE',
    bookedSlots: 8,
    maxSlots: 16,
    courtNames: 'Sân 1, Sân 2',
  },
  {
    id: 2,
    title: 'Ca Chủ Nhật Tuần Tới (Sắp diễn ra)',
    venueName: 'Sân Đại Phát',
    venueAddress: '123 Đường A',
    hostName: 'AnhDuck',
    startTime: '2026-09-20T13:00:00Z',
    endTime: '2026-09-20T16:00:00Z', // Upcoming
    status: 'UPCOMING',
    bookedSlots: 2,
    maxSlots: 16,
    courtNames: 'Sân 1, Sân 2',
  },
  {
    id: 3,
    title: 'Ca Tuần Trước (Đã kết thúc)',
    venueName: 'Sân Đại Phát',
    venueAddress: '123 Đường A',
    hostName: 'AnhDuck',
    startTime: '2026-09-01T13:00:00Z',
    endTime: '2026-09-01T16:00:00Z', // Completed
    status: 'COMPLETED',
    bookedSlots: 16,
    maxSlots: 16,
    courtNames: 'Sân 1, Sân 2',
  },
]

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SessionListView - Tabs & Responsive Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth(
      {
        id: 'host-1',
        fullName: 'Phạm Anh Đức',
        phone: '0325872682',
        role: 'HOST',
        avatarUrl: '/duck-host-sassy.png',
      } as any,
      'token-xyz'
    )
    ;(api.get as any).mockResolvedValue({ data: mockSessions })
  })

  it('renders status filter tabs and counters correctly', async () => {
    const Wrapper = createWrapper()
    render(<SessionListView />, { wrapper: Wrapper })

    expect(await screen.findByText(/Tất cả \(3\)/i)).toBeInTheDocument()
    expect(await screen.findByText(/Sắp tới/i)).toBeInTheDocument()
    expect(await screen.findByText(/Lịch sử \(1\)/i)).toBeInTheDocument()
  })

  it('filters to only Upcoming/Active sessions when clicking Sắp tới tab', async () => {
    const Wrapper = createWrapper()
    render(<SessionListView />, { wrapper: Wrapper })

    const upcomingTab = await screen.findByText(/Sắp tới/i)
    fireEvent.click(upcomingTab)

    expect(screen.getByText('Ca Tối Thứ 6 (Đang diễn ra)')).toBeInTheDocument()
    expect(screen.getByText('Ca Chủ Nhật Tuần Tới (Sắp diễn ra)')).toBeInTheDocument()
    expect(screen.queryByText('Ca Tuần Trước (Đã kết thúc)')).not.toBeInTheDocument()
  })

  it('filters to only Completed history sessions when clicking Lịch sử tab', async () => {
    const Wrapper = createWrapper()
    render(<SessionListView />, { wrapper: Wrapper })

    const historyTab = await screen.findByText(/Lịch sử/i)
    fireEvent.click(historyTab)

    expect(screen.getByText('Ca Tuần Trước (Đã kết thúc)')).toBeInTheDocument()
    expect(screen.queryByText('Ca Chủ Nhật Tuần Tới (Sắp diễn ra)')).not.toBeInTheDocument()
  })
})
