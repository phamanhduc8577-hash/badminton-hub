import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateSessionView } from '../views/CreateSessionView'
import { ToastProvider } from '../components/ToastProvider'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const renderView = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <ToastProvider>
        <MemoryRouter>
          <CreateSessionView />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )

describe('CreateSessionView - số sân, tên sân, số slot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('tên sân và slot gợi ý theo số sân cho tới khi Host tự sửa', () => {
    renderView()
    const count = screen.getByLabelText('Số sân') as HTMLInputElement
    const names = screen.getByLabelText(/Tên sân/) as HTMLInputElement
    const slots = screen.getByLabelText('Số lượng Slot tối đa') as HTMLInputElement

    expect(names.value).toBe('Sân 1, Sân 2')
    expect(slots.value).toBe('16')

    fireEvent.change(count, { target: { value: '3' } })
    expect(names.value).toBe('Sân 1, Sân 2, Sân 3')
    expect(slots.value).toBe('24')

    // Host tự sửa tên → đổi số sân không ghi đè nữa
    fireEvent.change(names, { target: { value: 'Sân A, Sân B, Sân C' } })
    fireEvent.change(count, { target: { value: '4' } })
    expect(names.value).toBe('Sân A, Sân B, Sân C')
    expect(screen.getByText('Đang có 3 tên sân cho 4 sân.')).toBeInTheDocument()

    // Host tự sửa slot → không tự gợi ý nữa
    fireEvent.change(slots, { target: { value: '20' } })
    fireEvent.change(count, { target: { value: '2' } })
    expect(slots.value).toBe('20')

    // Đặt lại theo số sân
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại theo số sân' }))
    expect(names.value).toBe('Sân 1, Sân 2')
  })

  it('ô số dạng chuỗi + inputMode numeric và có thông báo lỗi', () => {
    renderView()
    const count = screen.getByLabelText('Số sân') as HTMLInputElement
    const slots = screen.getByLabelText('Số lượng Slot tối đa') as HTMLInputElement
    expect(count).toHaveAttribute('inputmode', 'numeric')
    expect(slots).toHaveAttribute('inputmode', 'numeric')

    fireEvent.change(count, { target: { value: '' } })
    expect(count.value).toBe('')
    expect(screen.getByText('Vui lòng nhập số sân.')).toBeInTheDocument()

    fireEvent.change(slots, { target: { value: '816' } })
    expect(screen.getByText('Số slot phải từ 1 đến 60.')).toBeInTheDocument()
  })

  it('không gửi khi số liệu sai', async () => {
    renderView()
    fireEvent.change(screen.getByPlaceholderText(/Nhập tiêu đề ca đánh/), { target: { value: 'Ca test' } })
    fireEvent.change(screen.getByPlaceholderText(/Nhập tên sân/), { target: { value: 'Sân X' } })
    fireEvent.change(screen.getByPlaceholderText(/Nhập địa chỉ/), { target: { value: '1 Đường A' } })
    fireEvent.change(screen.getByLabelText('Số lượng Slot tối đa'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /Tạo ca đánh/ }))
    expect(await screen.findAllByText('Số slot phải từ 1 đến 60.')).not.toHaveLength(0)
    expect(api.post).not.toHaveBeenCalled()
  })

  it('gửi số sân, tên sân và slot dạng số', async () => {
    ;(api.post as any).mockResolvedValue({ data: { id: 9 } })
    renderView()
    fireEvent.change(screen.getByPlaceholderText(/Nhập tiêu đề ca đánh/), { target: { value: 'Ca test' } })
    fireEvent.change(screen.getByPlaceholderText(/Nhập tên sân/), { target: { value: 'Sân X' } })
    fireEvent.change(screen.getByPlaceholderText(/Nhập địa chỉ/), { target: { value: '1 Đường A' } })
    fireEvent.change(screen.getByLabelText('Số sân'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /Tạo ca đánh/ }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body] = (api.post as any).mock.calls[0]
    expect(url).toBe('/sessions')
    expect(body).toMatchObject({ courtCount: 3, courtNames: 'Sân 1, Sân 2, Sân 3', maxSlots: 24 })
  })

  it('tiêu đề tiền cọc đã sửa thành "Tiền cọc giữ chỗ"', () => {
    renderView()
    expect(screen.getByText('Ma trận giá slot & Tiền cọc giữ chỗ')).toBeInTheDocument()
    expect(screen.queryByText(/Tiền cọc 30%/)).not.toBeInTheDocument()
  })
})
