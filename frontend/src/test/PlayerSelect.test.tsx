import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { PlayerSelect } from '../components/PlayerSelect'

const options = [
  { id: 1, sessionId: 1, isGuest: false, name: 'An', phone: '0901', gender: 'MALE' },
  { id: 2, sessionId: 1, isGuest: true, name: 'Bình', phone: '0902', gender: 'FEMALE' },
] as any

const originalMatchMedia = window.matchMedia

const setPointer = (coarse: boolean | null) => {
  if (coarse === null) {
    // jsdom không có matchMedia
    ;(window as any).matchMedia = undefined
    return
  }
  ;(window as any).matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q === '(pointer: coarse)' ? coarse : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)))

describe('PlayerSelect', () => {
  afterEach(() => {
    ;(window as any).matchMedia = originalMatchMedia
  })

  it('trigger là <button>, không tự focus ô tìm kiếm trên thiết bị cảm ứng', async () => {
    setPointer(true)
    render(<PlayerSelect value="" onChange={() => {}} options={options} playerStatsMap={{}} ariaLabel="Team Blue - Player 1" />)

    const trigger = screen.getByRole('button', { name: /Team Blue - Player 1/ })
    expect(trigger.tagName).toBe('BUTTON')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await wait(100)
    const search = screen.getByRole('textbox', { name: 'Tìm tay vợt' })
    expect(document.activeElement).not.toBe(search)
    expect(search.className).toMatch(/text-base/)
  })

  it('có chuột / bàn phím thì vẫn tự focus ô tìm kiếm', async () => {
    setPointer(null)
    render(<PlayerSelect value="" onChange={() => {}} options={options} playerStatsMap={{}} />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    await wait(100)
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Tìm tay vợt' }))
  })

  it('nút bỏ chọn có nhãn rõ ràng và gọi onChange("")', () => {
    const onChange = vi.fn()
    render(<PlayerSelect value="1" onChange={onChange} options={options} playerStatsMap={{}} />)
    const clear = screen.getByRole('button', { name: 'Bỏ chọn An' })
    expect(clear.className).toMatch(/min-h-11/)
    expect(clear.className).toMatch(/min-w-11/)
    fireEvent.click(clear)
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('chạm ra ngoài (pointerdown) thì đóng danh sách', () => {
    setPointer(true)
    render(
      <div>
        <span>bên ngoài</span>
        <PlayerSelect value="" onChange={() => {}} options={options} playerStatsMap={{}} />
      </div>
    )
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByText('bên ngoài'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('chọn 1 người trong danh sách', () => {
    const onChange = vi.fn()
    render(<PlayerSelect value="" onChange={onChange} options={options} playerStatsMap={{}} />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    fireEvent.click(screen.getByRole('option', { name: /Bình/ }))
    expect(onChange).toHaveBeenCalledWith('2')
  })
})
