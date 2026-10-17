import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import { ToastProvider, useToast } from '../components/ToastProvider'

let consumerRenders = 0
const Consumer: React.FC = React.memo(() => {
  consumerRenders++
  const { showToast } = useToast()
  return <button onClick={() => showToast('Đã lưu!', 'success')}>Hiện toast</button>
})

describe('ToastProvider', () => {
  it('toast nằm trong vùng aria-live, có nút đóng ≥44px; consumer không render lại khi có toast', () => {
    consumerRenders = 0
    render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>
    )
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region.className).toContain('pt-[max(1rem,env(safe-area-inset-top))]')

    const rendersBefore = consumerRenders
    fireEvent.click(screen.getByRole('button', { name: 'Hiện toast' }))
    expect(within(region).getByText('Đã lưu!')).toBeInTheDocument()
    expect(consumerRenders).toBe(rendersBefore)

    const close = within(region).getByRole('button', { name: 'Đóng thông báo' })
    expect(close.className).toMatch(/min-h-11/)
    fireEvent.click(close)
    expect(within(region).queryByText('Đã lưu!')).not.toBeInTheDocument()
  })
})
