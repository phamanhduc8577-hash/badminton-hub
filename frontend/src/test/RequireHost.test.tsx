import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RequireHost } from '../App'
import { useAuthStore } from '../store/useAuthStore'

const LoginProbe = () => {
  const loc = useLocation()
  return <div data-testid="login">{loc.search}</div>
}

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<div>Trang chủ</div>} />
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/host/session/:id" element={<RequireHost><div>Bảng Host</div></RequireHost>} />
      </Routes>
    </MemoryRouter>
  )

describe('RequireHost', () => {
  beforeEach(() => useAuthStore.getState().logout())

  it('chưa đăng nhập → /login?redirect=<trang Host đang mở>', () => {
    renderAt('/host/session/5?tab=roster')
    expect(screen.getByTestId('login')).toHaveTextContent('?redirect=%2Fhost%2Fsession%2F5%3Ftab%3Droster')
  })

  it('thành viên thường → về trang chủ (không vòng lặp qua /login)', () => {
    useAuthStore.getState().setAuth({ id: 2, role: 'MEMBER' } as any, 'tok')
    renderAt('/host/session/5')
    expect(screen.getByText('Trang chủ')).toBeInTheDocument()
  })

  it('Host → vào được', async () => {
    useAuthStore.getState().setAuth({ id: 1, role: 'HOST' } as any, 'tok')
    renderAt('/host/session/5')
    expect(await screen.findByText('Bảng Host')).toBeInTheDocument()
  })
})
