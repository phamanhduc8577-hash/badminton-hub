import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfileModal } from '../components/ProfileModal'
import { useAuthStore } from '../store/useAuthStore'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const baseUser = {
  id: 7,
  fullName: 'Tên Cũ',
  phone: '0900000007',
  role: 'MEMBER',
  gender: 'MALE',
  membershipType: 'CASUAL',
  avatarUrl: '/duck-mascot.png',
  genderLocked: true,
} as any

const renderModal = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ProfileModal isOpen onClose={() => {}} />} />
          <Route path="/login" element={<div>TRANG ĐĂNG NHẬP</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('ProfileModal - mobile & token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth(baseUser, 'old-token')
    ;(api.get as any).mockResolvedValue({ data: baseUser })
  })

  it('không xóa tên đang gõ khi dữ liệu user trong store cập nhật lúc popup đang mở', async () => {
    renderModal()
    const input = screen.getByLabelText('Họ và tên của bạn')
    fireEvent.change(input, { target: { value: 'Tên Đang Gõ' } })

    // /auth/me trả về + một nơi khác cập nhật store
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/me'))
    act(() => {
      useAuthStore.getState().setAuth({ ...baseUser, avatarUrl: '/new.png', sessionsAttended: 9 }, 'old-token')
    })
    expect(input).toHaveValue('Tên Đang Gõ')
  })

  it('dùng token mới server trả về sau khi đổi mật khẩu, không lưu token vào object user', async () => {
    ;(api.put as any).mockResolvedValue({ data: { ...baseUser, fullName: 'Tên Cũ', token: 'new-token-after-password' } })
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /Đổi mật khẩu tài khoản/i }))
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'oldpass1' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'newpass1' } })
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: 'newpass1' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu hồ sơ/i }))

    await waitFor(() => expect(useAuthStore.getState().token).toBe('new-token-after-password'))
    expect((useAuthStore.getState().user as any).token).toBeUndefined()
    expect(localStorage.getItem('smashflow_token')).toBe('new-token-after-password')
    const payload = (api.put as any).mock.calls[0][1]
    expect(payload).toMatchObject({ oldPassword: 'oldpass1', newPassword: 'newpass1' })
  })

  it('giữ token cũ khi server không trả token mới (chỉ sửa tên)', async () => {
    ;(api.put as any).mockResolvedValue({ data: { ...baseUser, fullName: 'Tên Mới' } })
    renderModal()
    fireEvent.change(screen.getByLabelText('Họ và tên của bạn'), { target: { value: 'Tên Mới' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu hồ sơ/i }))
    await waitFor(() => expect(useAuthStore.getState().user?.fullName).toBe('Tên Mới'))
    expect(useAuthStore.getState().token).toBe('old-token')
  })

  it('ô mật khẩu có autocomplete đúng, nút ẩn/hiện có nhãn', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /Đổi mật khẩu tài khoản/i }))
    expect(screen.getByLabelText('Mật khẩu hiện tại')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Xác nhận mật khẩu mới')).toHaveAttribute('autocomplete', 'new-password')

    const toggle = screen.getByRole('button', { name: 'Hiện mật khẩu hiện tại' })
    fireEvent.click(toggle)
    expect(screen.getByLabelText('Mật khẩu hiện tại')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu hiện tại' })).toBeInTheDocument()
  })

  it('đăng xuất cần xác nhận rồi mới xóa phiên và chuyển về /login', async () => {
    renderModal()
    const dialog = screen.getByRole('dialog', { name: /Chỉnh sửa hồ sơ & Avatar/i })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đăng xuất' }))
    // Chưa đăng xuất ngay
    expect(useAuthStore.getState().user).not.toBeNull()
    expect(screen.getByText(/chắc chắn muốn đăng xuất/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đăng xuất' }))
    expect(useAuthStore.getState().user).toBeNull()
    expect(await screen.findByText('TRANG ĐĂNG NHẬP')).toBeInTheDocument()
  })

  it('bấm "Ở lại" thì hủy bước đăng xuất', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ở lại' }))
    expect(useAuthStore.getState().user).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
  })
})
