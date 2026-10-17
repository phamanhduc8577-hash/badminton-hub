import React, { useId, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { BottomSheet } from '../BottomSheet'
import { MAX_SLOTS, MIN_SLOTS, validateSlotCount } from './hostUtils'

interface CourtSettingsSheetProps {
  open: boolean
  onClose: () => void
  initialCourtNames: string
  initialMaxSlots: number
  bookedSlots: number
  courtList: string[]
  pending?: boolean
  onSave: (payload: { courtNames: string; maxSlots: number }) => void
  onRequestRemoveCourt: (courtName: string) => void
}

/** Cài đặt sân: đổi tên sân, số slot tối đa và xóa sân (tách khỏi thanh chọn sân để tránh bấm nhầm) */
export const CourtSettingsSheet: React.FC<CourtSettingsSheetProps> = (props) =>
  // Chỉ dựng form khi mở → mỗi lần mở nạp lại giá trị hiện tại, không ghi đè chữ đang gõ khi dữ liệu tự làm mới
  props.open ? <CourtSettingsSheetContent {...props} /> : null

const CourtSettingsSheetContent: React.FC<CourtSettingsSheetProps> = ({
  open,
  onClose,
  initialCourtNames,
  initialMaxSlots,
  bookedSlots,
  courtList,
  pending = false,
  onSave,
  onRequestRemoveCourt,
}) => {
  const [names, setNames] = useState(initialCourtNames)
  const [slots, setSlots] = useState(String(initialMaxSlots))
  const [slotError, setSlotError] = useState<string | null>(null)
  const namesId = useId()
  const slotsId = useId()
  const errorId = useId()

  const handleSave = () => {
    const err = validateSlotCount(slots)
    if (err) {
      setSlotError(err)
      return
    }
    setSlotError(null)
    onSave({ courtNames: names.trim(), maxSlots: Number(slots.trim()) })
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => !pending && onClose()}
      closeOnBackdrop={!pending}
      title="Cài đặt sân & số slot"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="min-h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm sm:text-xs transition disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !names.trim()}
            className="min-h-11 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-sm sm:text-xs shadow-md transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {pending ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm sm:text-xs">
        <div>
          <label htmlFor={namesId} className="block text-slate-700 font-bold mb-1.5">
            Danh sách sân (ngăn cách bằng dấu phẩy)
          </label>
          <input
            id={namesId}
            type="text"
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder="Sân 1, Sân 2, Sân 3"
            className="w-full min-h-11 border border-slate-300 rounded-xl px-3 text-base text-slate-900 font-medium focus:outline-none focus:border-slate-900"
          />
        </div>

        <div>
          <label htmlFor={slotsId} className="block text-slate-700 font-bold mb-1.5">
            Số slot tối đa ({MIN_SLOTS}–{MAX_SLOTS})
          </label>
          <input
            id={slotsId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={slots}
            aria-invalid={!!slotError}
            aria-describedby={slotError ? errorId : undefined}
            onChange={(e) => {
              setSlots(e.target.value.replace(/[^\d]/g, ''))
              if (slotError) setSlotError(null)
            }}
            className={`w-full min-h-11 border rounded-xl px-3 text-base text-slate-900 font-bold focus:outline-none ${
              slotError ? 'border-rose-500 focus:border-rose-600' : 'border-slate-300 focus:border-slate-900'
            }`}
          />
          {slotError ? (
            <p id={errorId} role="alert" className="mt-1.5 text-xs font-bold text-rose-600">
              {slotError}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-slate-500">Hiện đã có {bookedSlots} người đăng ký.</p>
          )}
        </div>

        {courtList.length > 1 && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <span className="block text-slate-700 font-bold">Đóng bớt sân</span>
            <ul className="space-y-1.5">
              {courtList.map((c) => (
                <li key={c} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 pl-3">
                  <span className="font-bold text-slate-900">🏸 {c}</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onRequestRemoveCourt(c)}
                    aria-label={`Xóa ${c}`}
                    className="min-h-11 px-3 inline-flex items-center gap-1.5 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-sm sm:text-xs transition disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    <span>Xóa sân</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
