import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { CourtSettingsSheet } from '../components/host/CourtSettingsSheet'
import { validateSlotCount } from '../components/host/hostUtils'

const setup = () => {
  const onSave = vi.fn()
  const onRequestRemoveCourt = vi.fn()
  render(
    <CourtSettingsSheet
      open
      onClose={() => {}}
      initialCourtNames="Sân 1, Sân 2"
      initialMaxSlots={8}
      bookedSlots={5}
      courtList={['Sân 1', 'Sân 2']}
      onSave={onSave}
      onRequestRemoveCourt={onRequestRemoveCourt}
    />
  )
  return { onSave, onRequestRemoveCourt, input: screen.getByLabelText(/Số slot tối đa/) as HTMLInputElement }
}

describe('CourtSettingsSheet - ô số slot', () => {
  it('giữ dạng chuỗi với inputMode numeric, xóa trống không tự về 8', () => {
    const { input } = setup()
    expect(input).toHaveAttribute('inputmode', 'numeric')
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
  })

  it('từ chối 816 và 0, báo lỗi ngay dưới ô', () => {
    const { input, onSave } = setup()

    fireEvent.change(input, { target: { value: '816' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Số slot phải từ 1 đến 60.')
    expect(input).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Số slot phải từ 1 đến 60.')

    expect(onSave).not.toHaveBeenCalled()
  })

  it('giá trị hợp lệ thì lưu dạng số', () => {
    const { input, onSave } = setup()
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }))
    expect(onSave).toHaveBeenCalledWith({ courtNames: 'Sân 1, Sân 2', maxSlots: 12 })
  })

  it('nút xóa sân nằm trong cài đặt sân', () => {
    const { onRequestRemoveCourt } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa Sân 2' }))
    expect(onRequestRemoveCourt).toHaveBeenCalledWith('Sân 2')
  })

  it('validateSlotCount', () => {
    expect(validateSlotCount('')).toBe('Vui lòng nhập số slot.')
    expect(validateSlotCount('816')).not.toBeNull()
    expect(validateSlotCount('0')).not.toBeNull()
    expect(validateSlotCount('1')).toBeNull()
    expect(validateSlotCount('60')).toBeNull()
    expect(validateSlotCount('61')).not.toBeNull()
  })
})
