import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginView } from '../views/LoginView'
import { useAuthStore } from '../store/useAuthStore'

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

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

describe('LoginView - Auth & Redirect Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().logout()
  })

  it('renders login form when user is NOT authenticated', () => {
    const Wrapper = createWrapper()
    render(<LoginView />, { wrapper: Wrapper })

    expect(screen.getByText(/Đăng nhập hệ thống/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Nhập số điện thoại của bạn/i)).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('redirects to home (/) when user is already logged in with token', () => {
    useAuthStore.getState().setAuth(
      {
        id: 'user-1',
        fullName: 'Test User',
        phone: '0912345678',
        role: 'MEMBER',
      } as any,
      'valid-token'
    )

    const Wrapper = createWrapper()
    render(<LoginView />, { wrapper: Wrapper })

    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })
})
