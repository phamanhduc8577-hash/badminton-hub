/**
 * Direct Telegram Notification Helper for Frontend Client
 * Fallback & instant alert direct pipeline with proper UTF-8 payload encoding
 */
export async function sendDirectTelegramNotification(message: string): Promise<boolean> {
  try {
    const botToken = '8664493359:AAEIrvA-XuX3aoclYOOh5bAyvMdDOLDu7UE'
    const chatId = '8723745423'
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })

    const data = await response.json()
    return !!data.ok
  } catch (err) {
    console.warn('Frontend direct Telegram notification error:', err)
    return false
  }
}

export function notifyNewUserRegisteredDirect(
  fullName: string,
  phone: string,
  gender: string,
  membershipType: string
) {
  const isFixed = membershipType === 'FIXED' || membershipType === 'PENDING_FIXED'
  const typeLabel = isFixed
    ? '⏳ Đăng ký Thành viên Cố định (Đang chờ Host duyệt)'
    : '🟡 Thành viên / Khách Vãng lai'

  const genderLabel = gender === 'FEMALE' ? 'Nữ (Trợ giá)' : 'Nam'

  const msg =
    `🎉 <b>[SmashFlow] CÓ THÀNH VIÊN MỚI TẠO TÀI KHOẢN!</b>\n\n` +
    `👤 <b>Họ tên:</b> ${escapeHtml(fullName)}\n` +
    `📞 <b>Số điện thoại:</b> <code>${escapeHtml(phone)}</code>\n` +
    `⚧ <b>Giới tính:</b> ${genderLabel}\n` +
    `🏷️ <b>Phân loại:</b> ${typeLabel}\n\n` +
    (isFixed
      ? `👉 <i>Vui lòng vào mục Thành viên trên Web để phê duyệt cho thành viên này!</i>`
      : `✅ <i>Tài khoản đã kích hoạt sẵn sàng tham gia ca đánh.</i>`)

  return sendDirectTelegramNotification(msg)
}

export function notifyNewBookingDirect(
  sessionTitle: string,
  timeRange: string,
  playerName: string,
  phone: string,
  gender: string,
  memberType: string,
  feeNote: string
) {
  const genderLabel = gender === 'FEMALE' ? 'Nữ' : 'Nam'

  const msg =
    `🏸 <b>[SmashFlow] CÓ KHÁCH MỚI ĐĂNG KÝ!</b>\n\n` +
    `👤 <b>Tay vợt:</b> ${escapeHtml(playerName)} (${escapeHtml(phone)} - ${genderLabel})\n` +
    `🏷️ <b>Hạng:</b> ${escapeHtml(memberType)}\n` +
    `🏆 <b>Ca đánh:</b> ${escapeHtml(sessionTitle)}\n` +
    `⏰ <b>Thời gian:</b> ${escapeHtml(timeRange)}\n` +
    `💰 <b>Trạng thái:</b> ${escapeHtml(feeNote)}\n\n` +
    `<i>📱 Vui lòng kiểm tra trên Host Dashboard khi cần chốt danh sách!</i>`

  return sendDirectTelegramNotification(msg)
}

export function notifyDepositReceivedDirect(
  sessionTitle: string,
  playerName: string,
  phone: string,
  amount: string
) {
  const msg =
    `⚡ <b>[SmashFlow] ĐÃ NHẬN TIỀN CỌC!</b>\n\n` +
    `👤 <b>Khách hàng:</b> ${escapeHtml(playerName)} (${escapeHtml(phone)})\n` +
    `💵 <b>Số tiền cọc:</b> ${escapeHtml(amount)} VNĐ\n` +
    `🏸 <b>Ca đánh:</b> ${escapeHtml(sessionTitle)}\n` +
    `✅ <b>Trạng thái:</b> Đã xác nhận cọc - Mở khóa Điểm danh GPS cho khách!`

  return sendDirectTelegramNotification(msg)
}

function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
