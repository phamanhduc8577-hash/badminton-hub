import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { BottomSheet } from '../components/BottomSheet'

describe('BottomSheet', () => {
  it('không render gì khi đóng', () => {
    render(
      <BottomSheet open={false} onClose={() => {}} title="Tiêu đề">
        Nội dung
      </BottomSheet>
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('khi mở: có role=dialog, aria-modal, tiêu đề, nội dung và footer', () => {
    render(
      <BottomSheet open onClose={() => {}} title="Quét VietQR" footer={<button>Xác nhận</button>}>
        <p>Nội dung QR</p>
      </BottomSheet>
    )
    const dialog = screen.getByRole('dialog', { name: 'Quét VietQR' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Nội dung QR')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeInTheDocument()
  })

  it('dùng labelledBy khi không truyền title', () => {
    render(
      <BottomSheet open onClose={() => {}} labelledBy="custom-title">
        <h3 id="custom-title">Điểm danh 1-Chạm</h3>
      </BottomSheet>
    )
    expect(screen.getByRole('dialog', { name: 'Điểm danh 1-Chạm' })).toBeInTheDocument()
  })

  it('nút đóng có nhãn "Đóng" và gọi onClose', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open onClose={onClose} title="A">
        x
      </BottomSheet>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('phím Esc đóng popup', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open onClose={onClose} title="A">
        x
      </BottomSheet>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('chạm nền tối đóng popup; chạm bên trong thì không', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open onClose={onClose} title="A">
        <p>Bên trong</p>
      </BottomSheet>
    )
    fireEvent.click(screen.getByText('Bên trong'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closeOnBackdrop=false: chạm nền không đóng', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open onClose={onClose} title="A" closeOnBackdrop={false}>
        x
      </BottomSheet>
    )
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('khóa cuộn trang khi mở và mở khóa khi đóng', () => {
    document.body.style.overflow = ''
    const { rerender } = render(
      <BottomSheet open onClose={() => {}} title="A">
        x
      </BottomSheet>
    )
    expect(document.body.style.overflow).toBe('hidden')
    rerender(
      <BottomSheet open={false} onClose={() => {}} title="A">
        x
      </BottomSheet>
    )
    expect(document.body.style.overflow).toBe('')
  })

  it('2 sheet chồng nhau: Esc chỉ đóng sheet trên cùng', () => {
    const closeBottom = vi.fn()
    const closeTop = vi.fn()
    render(
      <>
        <BottomSheet open onClose={closeBottom} title="Dưới">
          x
        </BottomSheet>
        <BottomSheet open onClose={closeTop} title="Trên">
          y
        </BottomSheet>
      </>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closeTop).toHaveBeenCalledTimes(1)
    expect(closeBottom).not.toHaveBeenCalled()
  })
})
