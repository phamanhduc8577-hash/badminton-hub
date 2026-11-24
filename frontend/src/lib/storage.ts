/**
 * Tiện ích tải ảnh đại diện lên Supabase Storage bucket 'Avatars'
 * Sử dụng Web API gốc (fetch + canvas), không cài thêm thư viện để giữ bundle siêu nhẹ.
 */

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://furlzlnaexlyolplewqh.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1cmx6bG5hZXhseW9scGxld3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MjQ5ODcsImV4cCI6MjEwNDIwMDk4N30.IlKzIt2Thiq6VC_Mxn3KfEGSMPR8ieyMPk_peXPywQE'
const BUCKET = 'Avatars'

/**
 * Nén và cắt vuông ảnh về kích thước 128x128 JPEG (khoảng 5-8KB).
 */
export async function resizeImageToBlob(file: File, size = 128, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Không thể nạp dữ liệu ảnh'))
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Canvas context không khả dụng'))
            return
          }
          const minDim = Math.min(img.width, img.height)
          const sx = (img.width - minDim) / 2
          const sy = (img.height - minDim) / 2
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Không thể nén ảnh sang Blob'))
              }
            },
            'image/jpeg',
            quality
          )
        } catch (err) {
          reject(err)
        }
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Tải ảnh đại diện lên Supabase Storage và trả về URL công khai.
 * Tên file đặt theo identifier (vd. số điện thoại hoặc id) + timestamp ngẫu nhiên.
 */
export async function uploadAvatarToStorage(file: File, identifier = 'user'): Promise<string> {
  const blob = await resizeImageToBlob(file, 128, 0.8)
  const safeIdentifier = identifier.replace(/[^a-zA-Z0-9_-]/g, '')
  const fileName = `avatar_${safeIdentifier || 'member'}_${Date.now()}.jpg`

  const uploadEndpoint = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${fileName}`

  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: blob,
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Tải ảnh lên Supabase thất bại (${response.status}): ${errText}`)
  }

  // URL công khai để lưu vào database & hiển thị
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${fileName}`
}
