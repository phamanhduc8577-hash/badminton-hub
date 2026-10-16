import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemberListView } from '../views/MemberListView'
import { ProfileModal } from '../components/ProfileModal'
import { useAuthStore } from '../store/useAuthStore'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

const baseUser = {
  id: 7,
  fullName: 'Lỡ Tay',
  phone: '0900000007',
  role: 'MEMBER',
  gender: 'FEMALE',
  membershipType: 'CASUAL',
  avatarUrl: '/duck-mascot.png',
  sessionsAttended: 0,
  winCount: 0,
  lossCount: 0,
  winRate: 0,
}

const member = { ...baseUser, eloScore: 0, placementMatches: 0, shieldMatches: 0, createdAt: '2026-10-01T00:00:00Z' }

describe('ProfileModal - tự sửa giới tính', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const setup = (genderLocked: boolean) => {
    const user = { ...baseUser, genderLocked } as any
    useAuthStore.getState().setAuth(user, 'tok')
    ;(api.get as any).mockResolvedValue({ data: user })
    ;(api.put as any).mockResolvedValue({ data: { ...user, gender: 'MALE' } })
    render(<ProfileModal isOpen onClose={() => {}} />, { wrapper })
  }

  it('chưa tham gia ca: chọn Nam rồi lưu thì gửi gender=MALE và hiện cảnh báo tính lại giá', async () => {
    setup(false)
    const male = screen.getByRole('radio', { name: 'Nam' })
    expect(male).not.toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Nữ' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(male)
    expect(male).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/sẽ được tính lại theo giới tính mới/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Lưu hồ sơ/i }))
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [url, payload] = (api.put as any).mock.calls[0]
    expect(url).toBe('/auth/profile')
    expect(payload.gender).toBe('MALE')
  })

  it('không đổi giới tính thì không gửi trường gender', async () => {
    setup(false)
    fireEvent.click(screen.getByRole('button', { name: /Lưu hồ sơ/i }))
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    expect((api.put as any).mock.calls[0][1].gender).toBeUndefined()
  })

  it('đã tham gia ca: nút giới tính bị khóa, có hướng dẫn liên hệ Host, không gửi gender', async () => {
    setup(true)
    const male = screen.getByRole('radio', { name: 'Nam' })
    expect(male).toBeDisabled()
    expect(screen.getByText(/nhắn Host/i)).toBeInTheDocument()

    fireEvent.click(male)
    fireEvent.click(screen.getByRole('button', { name: /Lưu hồ sơ/i }))
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    expect((api.put as any).mock.calls[0][1].gender).toBeUndefined()
  })

  it('hiển thị lỗi từ server (ví dụ vừa bị khóa giữa chừng)', async () => {
    setup(false)
    ;(api.put as any).mockRejectedValue({
      response: { data: { message: 'Bạn đã tham gia/thanh toán ca đánh nên không thể tự đổi giới tính.' } },
    })
    fireEvent.click(screen.getByRole('radio', { name: 'Nam' }))
    fireEvent.click(screen.getByRole('button', { name: /Lưu hồ sơ/i }))
    expect(await screen.findByText(/không thể tự đổi giới tính/i)).toBeInTheDocument()
  })
})

describe('MemberListView - Host sửa giới tính', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(api.get as any).mockResolvedValue({ data: [member] })
  })

  it('Host bấm badge giới tính → chọn Nam → gọi PUT /members/7/gender', async () => {
    useAuthStore.getState().setAuth({ id: 1, fullName: 'Host', phone: '1', role: 'HOST', gender: 'MALE' } as any, 'tok')
    ;(api.put as any).mockResolvedValue({ data: { ...member, gender: 'MALE' } })
    render(<MemberListView />, { wrapper })

    fireEvent.click(await screen.findByRole('button', { name: /Khách Vãng lai/ }))
    const badge = await screen.findByRole('button', { name: /Sửa giới tính của Lỡ Tay/i })
    fireEvent.click(badge)

    expect(await screen.findByRole('dialog', { name: /Sửa giới tính/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nữ \(hiện tại\)/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /^Nam$/ }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/members/7/gender', { gender: 'MALE' }))
  })

  it('Thành viên thường không thấy nút sửa giới tính', async () => {
    useAuthStore.getState().setAuth({ ...baseUser, id: 99, role: 'MEMBER' } as any, 'tok')
    render(<MemberListView />, { wrapper })
    fireEvent.click(await screen.findByRole('button', { name: /Khách Vãng lai/ }))
    expect(await screen.findByText('Nữ (Trợ giá)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sửa giới tính/i })).not.toBeInTheDocument()
  })
})
