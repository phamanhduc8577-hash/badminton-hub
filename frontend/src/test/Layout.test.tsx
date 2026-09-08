import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
})
