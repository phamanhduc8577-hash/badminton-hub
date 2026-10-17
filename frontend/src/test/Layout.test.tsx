import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { useAuthStore } from '../store/useAuthStore'

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

describe('Layout - Mobile Navigation & Profile Behavior', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('renders "Tài khoản" link to /login when user is NOT logged in', () => {
    const Wrapper = createWrapper()
    render(<Layout />, { wrapper: Wrapper })

    const accountLinks = screen.getAllByRole('link', { name: /Tài khoản/i })
    expect(accountLinks.length).toBeGreaterThan(0)
    expect(accountLinks[0]).toHaveAttribute('href', '/login')
  })

  it('renders user button and opens ProfileModal on click when logged in as MEMBER', () => {
    useAuthStore.getState().setAuth(
      {
        id: '123',
        fullName: 'Nguyễn Văn Member',
        phone: '0912345678',
        role: 'MEMBER',
        avatarUrl: '/custom-avatar.png',
        gender: 'MALE',
        membershipType: 'CASUAL',
      } as any,
      'fake-token-123'
    )

    const Wrapper = createWrapper()
    render(<Layout />, { wrapper: Wrapper })

    // Mobile nav shows user name button instead of /login link
    const userButton = screen.getByRole('button', { name: /Member/i })
    expect(userButton).toBeInTheDocument()

    // ProfileModal is not visible yet
    expect(screen.queryByText(/Chỉnh sửa hồ sơ & Avatar/i)).not.toBeInTheDocument()

    // Click on mobile profile button
    fireEvent.click(userButton)

    // ProfileModal pops up with user info
    expect(screen.getByText(/Chỉnh sửa hồ sơ & Avatar/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Nguyễn Văn Member')).toBeInTheDocument()
  })

  it('renders "Host" link to /host when logged in as HOST', () => {
    useAuthStore.getState().setAuth(
      {
        id: 'host-1',
        fullName: 'Admin Host',
        phone: '0987654321',
        role: 'HOST',
        avatarUrl: '/duck-host-sassy.png',
        gender: 'MALE',
        membershipType: 'FIXED',
      } as any,
      'host-token'
    )

    const Wrapper = createWrapper()
    render(<Layout />, { wrapper: Wrapper })

    const hostLinks = screen.getAllByRole('link', { name: /Host/i })
    expect(hostLinks.length).toBeGreaterThan(0)
    const mobileHostLink = hostLinks.find((l) => l.getAttribute('href') === '/host')
    expect(mobileHostLink).toBeDefined()
  })

  it('menu dưới (mobile) vẫn render đủ mục, mỗi mục min-h-11 và chừa safe-area iPhone', () => {
    const Wrapper = createWrapper()
    render(<Layout />, { wrapper: Wrapper })

    const bottomNav = screen.getByRole('navigation', { name: 'Điều hướng chính' })
    expect(bottomNav.className).toContain('pb-[calc(0.75rem+env(safe-area-inset-bottom))]')
    const items = within(bottomNav).getAllByRole('link')
    expect(items.map((l) => l.getAttribute('href'))).toEqual(['/', '/leaderboard', '/members', '/loyalty', '/login'])
    items.forEach((l) => expect(l.className).toMatch(/flex-1.*min-h-11/))
  })

  it('đăng xuất có trong popup hồ sơ (dùng được trên mobile)', () => {
    useAuthStore.getState().setAuth(
      { id: 5, fullName: 'Nguyễn Văn Member', phone: '0912345678', role: 'MEMBER', gender: 'MALE', membershipType: 'CASUAL' } as any,
      'fake-token'
    )
    const Wrapper = createWrapper()
    render(<Layout />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole('button', { name: /Member/i }))
    const dialog = screen.getByRole('dialog', { name: /Chỉnh sửa hồ sơ & Avatar/i })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đăng xuất' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận đăng xuất' }))
    expect(useAuthStore.getState().user).toBeNull()
  })
})
