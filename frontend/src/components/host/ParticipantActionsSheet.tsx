import React from 'react'
import { Edit2, Wallet, Undo2, RotateCcw, Trash2, Loader2 } from 'lucide-react'
import { BottomSheet } from '../BottomSheet'
import { ActionListItem as ActionItem, ActionListDivider } from './ActionListItem'
import {
  HostParticipant,
  canConfirmDeposit,
  editBillBlockReason,
  formatVnd,
  participantDisplayName,
  removeBlockReason,
} from './hostUtils'

interface ParticipantActionsSheetProps {
  participant: HostParticipant | null
  onClose: () => void
  onEditBill: (p: HostParticipant) => void
  onConfirmDeposit: (p: HostParticipant) => void
  onCancelCheckin: (p: HostParticipant) => void
  onUndoPayment: (p: HostParticipant) => void
  onRemove: (p: HostParticipant) => void
  /** Đang xác nhận cọc cho người này */
  depositPending?: boolean
}

/** Menu "⋯" của 1 người chơi: các thao tác phụ, thao tác xóa luôn nằm cuối và màu đỏ */
export const ParticipantActionsSheet: React.FC<ParticipantActionsSheetProps> = ({
  participant: p,
  onClose,
  onEditBill,
  onConfirmDeposit,
  onCancelCheckin,
  onUndoPayment,
  onRemove,
  depositPending = false,
}) => {
  if (!p) return null

  const editBlock = editBillBlockReason(p)
  const removeBlock = removeBlockReason(p)
  const isAbsent = p.checkinStatus === 'ABSENT'

  return (
    <BottomSheet open onClose={onClose} title={`Thao tác: ${participantDisplayName(p)}`}>
      <ul className="space-y-1 -mx-2" aria-label="Danh sách thao tác">
        <ActionItem
          icon={<Edit2 size={18} />}
          label="Sửa hóa đơn"
          hint={editBlock ?? `Hóa đơn hiện tại ${formatVnd(p.finalFee)}`}
          disabled={!!editBlock}
          onClick={() => onEditBill(p)}
        />
        {canConfirmDeposit(p) && (
          <ActionItem
            icon={depositPending ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
            label={depositPending ? 'Đang xác nhận cọc...' : 'Xác nhận đã nhận cọc'}
            hint={`Cọc ${formatVnd(p.depositAmount)}`}
            disabled={depositPending}
            onClick={() => onConfirmDeposit(p)}
          />
        )}
        {p.checkinStatus === 'CHECKED_IN' && (
          <ActionItem
            icon={<Undo2 size={18} />}
            label="Hủy điểm danh"
            hint="Dùng khi lỡ bấm nhầm"
            onClick={() => onCancelCheckin(p)}
          />
        )}
        {p.canUndoPayment === true && (
          <ActionItem
            icon={<RotateCcw size={18} />}
            label="Hoàn tác thu tiền"
            hint="Chuyển lượt này về chưa thanh toán"
            onClick={() => onUndoPayment(p)}
          />
        )}
        {!isAbsent && (
          <>
            <ActionListDivider />
            <ActionItem
              icon={<Trash2 size={18} />}
              label="Xóa khỏi ca"
              hint={removeBlock ?? 'Nhường slot cho người khác'}
              disabled={!!removeBlock}
              destructive
              onClick={() => onRemove(p)}
            />
          </>
        )}
      </ul>
    </BottomSheet>
  )
}
