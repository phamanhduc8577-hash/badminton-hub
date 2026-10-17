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

const base = {
  role: 'MEMBER',
  avatarUrl: '/duck-mascot.png',
  winCount: 1,
  lossCount: 1,
  winRate: 50,
  eloScore: 10,
  sessionsAttended: 3,
  placementMatches: 5,
  shieldMatches: 0,
  createdAt: '2026-09-01T00:00:00Z',
}

const members = [
  { ...base, id: 1, fullName: 'Nguyễn Văn An', phone: '0912345678', gender: 'MALE', membershipType: 'FIXED' },
  { ...base, id: 2, fullName: 'Đỗ Quỳnh Như', phone: '0908555666', gender: 'FEMALE', membershipType: 'PENDING_FIXED' },
]

const renderView = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <MemoryRouter>
          <MemberListView />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )

describe('MemberListView - thẻ & menu thao tác trên mobile', { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth({ id: 99, fullName: 'Host', phone: '1', role: 'HOST', gender: 'MALE' } as any, 'tok')
    ;(api.get as any).mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/members' ? members : [] })
    )
  })

  it('menu "⋯" mở BottomSheet, Xóa nằm cuối và gọi DELETE sau khi xác nhận', async () => {
    ;(api.delete as any).mockResolvedValue({ data: { message: 'Đã xóa' } })
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Thao tác cho Nguyễn Văn An' }, { timeout: 8000 }))
    const sheet = await screen.findByRole('dialog', { name: /Thao tác: Nguyễn Văn An/ })
    const actions = within(within(sheet).getByRole('list', { name: 'Danh sách thao tác' })).getAllByRole('button')
    expect(actions[0]).toHaveTextContent('Chỉnh Rank & LP')
    expect(within(sheet).getByRole('button', { name: /Chuyển về Vãng Lai/ })).toBeInTheDocument()
    expect(actions[actions.length - 1]).toHaveTextContent('Xóa tài khoản')

    fireEvent.click(actions[actions.length - 1])
    fireEvent.click(await screen.findByRole('button', { name: /Đồng ý xóa/ }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/members/1'))
  })

  it('Duyệt Cố Định chỉ khóa đúng thành viên đang xử lý', async () => {
    ;(api.post as any).mockImplementation(() => new Promise(() => {}))
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: /Chờ duyệt cố định/ }, { timeout: 8000 }))
    fireEvent.click(await screen.findByRole('button', { name: 'Thao tác cho Đỗ Quỳnh Như' }))
    const sheet = await screen.findByRole('dialog', { name: /Thao tác: Đỗ Quỳnh Như/ })
    fireEvent.click(within(sheet).getByRole('button', { name: /Duyệt Cố Định/ }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/members/2/approve-fixed'))
    expect(await within(sheet).findByRole('button', { name: /Đang xử lý/ })).toBeDisabled()
  })

  it('Khôi phục thành viên nằm trên thanh công cụ', async () => {
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: /Khôi phục thành viên/ }, { timeout: 8000 }))
    expect(await screen.findByRole('dialog', { name: /Khôi phục thành viên đã xóa/ })).toBeInTheDocument()
  })

  it('Tối ưu ảnh đại diện xác nhận bằng BottomSheet thay cho window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    ;(api.post as any).mockResolvedValue({ data: { changed: 2, failed: 0, beforeKb: 300, afterKb: 100, savedKb: 200 } })
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: /Tối ưu ảnh đại diện/ }, { timeout: 8000 }))
    const sheet = await screen.findByRole('dialog', { name: /Thu nhỏ ảnh đại diện/ })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Tiếp tục thu nhỏ' }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/members/optimize-avatars', null, { params: { apply: true } })
    )
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
