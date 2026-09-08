import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemberListView } from '../views/MemberListView'
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

const mockMembers = [
  {
    id: 1,
    fullName: 'Nguyễn Văn An',
    phone: '0912345678',
    role: 'MEMBER',
    gender: 'MALE',
    membershipType: 'FIXED',
    avatarUrl: '/duck-mascot.png',
    winCount: 8,
    lossCount: 4,
    eloScore: 35,
    sessionsAttended: 15,
    placementMatches: 5,
    currentStreak: 2,
    shieldMatches: 1,
    createdAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 2,
    fullName: 'Đỗ Quỳnh Như',
    phone: '0908555666',
    role: 'MEMBER',
    gender: 'FEMALE',
    membershipType: 'PENDING_FIXED',
    avatarUrl: '/duck-mascot.png',
    winCount: 3,
    lossCount: 2,
    eloScore: 15,
    sessionsAttended: 4,
    placementMatches: 3,
    currentStreak: 1,
    shieldMatches: 0,
    createdAt: '2026-09-02T00:00:00Z',
  },
  {
    id: 3,
    fullName: 'Trần Thị Bình',
    phone: '0987654321',
    role: 'MEMBER',
    gender: 'FEMALE',
    membershipType: 'CASUAL',
    avatarUrl: '/duck-mascot.png',
    winCount: 5,
    lossCount: 5,
    eloScore: 20,
    sessionsAttended: 10,
    placementMatches: 5,
    currentStreak: 0,
    shieldMatches: 0,
    createdAt: '2026-09-03T00:00:00Z',
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

describe('MemberListView - Management & Single Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth(
      {
        id: 'host-1',
        fullName: 'Phạm Anh Đức',
        phone: '0325872682',
        role: 'HOST',
        avatarUrl: '/duck-host-sassy.png',
        gender: 'MALE',
        membershipType: 'FIXED',
      } as any,
      'fake-host-token'
    )
    ;(api.get as any).mockResolvedValue({ data: mockMembers })
  })

  it('renders pending counter with "người" instead of "đơn"', async () => {
    const Wrapper = createWrapper()
    render(<MemberListView />, { wrapper: Wrapper })

    const counters = await screen.findAllByText(/người/i)
    expect(counters.length).toBeGreaterThan(0)
    expect(screen.queryByText(/đơn/i)).not.toBeInTheDocument()
  })

  it('triggers delete API for single user ID when confirmed', async () => {
    vi.stubGlobal('confirm', () => true)
    ;(api.delete as any).mockResolvedValue({
      data: { message: 'Đã xóa tài khoản thành công!' },
    })

    const Wrapper = createWrapper()
    render(<MemberListView />, { wrapper: Wrapper })

    const deleteButtons = await screen.findAllByTitle(/Xóa vĩnh viễn tài khoản thành viên này/i)
    expect(deleteButtons.length).toBeGreaterThan(0)

    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/members/1')
    })
  })
})
