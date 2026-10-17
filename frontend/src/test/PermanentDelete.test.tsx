import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemberListView } from '../views/MemberListView'
import { ToastProvider } from '../components/ToastProvider'
import { useAuthStore } from '../store/useAuthStore'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ToastProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ToastProvider>
  </QueryClientProvider>
)

const deletedMember = {
  id: 42,
  fullName: 'Nguyễn Văn A',
  phone: '0901234567',
  role: 'MEMBER',
  gender: 'MALE',
  membershipType: 'CASUAL',
  avatarUrl: '/duck-mascot.png',
  sessionsAttended: 3,
  winCount: 1,
  lossCount: 1,
  winRate: 50,
  eloScore: 0,
  placementMatches: 0,
  shieldMatches: 0,
  createdAt: '2026-10-01T00:00:00Z',
}

const setup = async () => {
  useAuthStore.getState().setAuth({ id: 1, fullName: 'Host', phone: '1', role: 'HOST', gender: 'MALE' } as any, 'tok')
  ;(api.get as any).mockImplementation(async (url: string) => ({
    data: url === '/members/deleted' ? [deletedMember] : [],
  }))
  render(<MemberListView />, { wrapper })
  fireEvent.click(await screen.findByRole('button', { name: /Khôi phục thành viên/ }))
  const restoreDialog = await screen.findByRole('dialog', { name: /Khôi phục thành viên đã xóa/ })
  return restoreDialog
}

const openPurgeSheet = async () => {
  const restoreDialog = await setup()
  fireEvent.click(await within(restoreDialog).findByRole('button', { name: /Xóa vĩnh viễn Nguyễn Văn A/ }))
  const sheet = await screen.findByRole('dialog', { name: /Xóa vĩnh viễn thành viên/ })
  const input = within(sheet).getByLabelText(/Gõ lại tên 'Nguyễn Văn A' để xác nhận/)
  const confirm = within(sheet).getByRole('button', { name: /^Xóa vĩnh viễn$/ })
  return { sheet, input, confirm }
}

describe('MemberListView - Xóa vĩnh viễn thành viên', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mỗi dòng trong popup Khôi phục có nút "Xóa vĩnh viễn" riêng với nút "Khôi phục"', async () => {
    const restoreDialog = await setup()
    expect(await within(restoreDialog).findByRole('button', { name: /^Khôi phục$/ })).toBeInTheDocument()
    expect(within(restoreDialog).getByRole('button', { name: /Xóa vĩnh viễn Nguyễn Văn A/ })).toBeInTheDocument()
  })

  it('cảnh báo rõ hậu quả; nút xác nhận chỉ bật khi gõ đúng tên', async () => {
    const { sheet, input, confirm } = await openPurgeSheet()
    expect(within(sheet).getByText(/KHÔNG THỂ hoàn tác/)).toBeInTheDocument()
    expect(within(sheet).getByText(/có thể đăng ký tài khoản mới/)).toBeInTheDocument()
    expect(within(sheet).getByText(/Lịch sử thanh toán và các trận đấu được giữ lại/)).toBeInTheDocument()

    expect(confirm).toBeDisabled()
    fireEvent.change(input, { target: { value: 'Nguyễn Văn' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(input, { target: { value: 'nguyễn văn a' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(input, { target: { value: '  Nguyễn Văn A ' } })
    expect(confirm).not.toBeDisabled()
  })

  it('xác nhận gọi DELETE /members/42/permanent với body confirmName và đóng popup khi thành công', async () => {
    ;(api.delete as any).mockResolvedValue({ data: { message: 'Đã xóa vĩnh viễn tài khoản Nguyễn Văn A.' } })
    const { input, confirm } = await openPurgeSheet()
    fireEvent.change(input, { target: { value: 'Nguyễn Văn A' } })
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('/members/42/permanent', { data: { confirmName: 'Nguyễn Văn A' } })
    )
    expect(await screen.findByText('Đã xóa vĩnh viễn tài khoản Nguyễn Văn A.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Xóa vĩnh viễn thành viên/ })).not.toBeInTheDocument()
    )
  })

  it('lỗi 400 từ server → hiện thông báo lỗi, popup vẫn mở', async () => {
    ;(api.delete as any).mockRejectedValue({ response: { status: 400, data: { message: 'Tên xác nhận không khớp!' } } })
    const { input, confirm } = await openPurgeSheet()
    fireEvent.change(input, { target: { value: 'Nguyễn Văn A' } })
    fireEvent.click(confirm)

    expect(await screen.findByText('Tên xác nhận không khớp!')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /Xóa vĩnh viễn thành viên/ })).toBeInTheDocument()
  })
})
