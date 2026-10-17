import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/useAuthStore'
import { api } from '../lib/api'
import { DuckMascot } from './DuckMascot'
import { BottomSheet } from './BottomSheet'
import { User as UserIcon, Upload, Check, Sparkles, Camera, Lock, KeyRound, Eye, EyeOff, LogOut } from 'lucide-react'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, setAuth, token, logout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(user?.fullName || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '/duck-mascot.png')
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>(user?.gender === 'FEMALE' ? 'FEMALE' : 'MALE')
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOldPass, setShowOldPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Chỉ nạp lại form ở thời điểm popup vừa mở. Không reset khi `user` trong store đổi
  // (vd. /auth/me trả về giữa chừng) để không xóa chữ người dùng đang gõ.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false
      return
    }
    if (wasOpenRef.current || !user) return
    wasOpenRef.current = true
    setFullName(user.fullName || '')
    setAvatarUrl(user.avatarUrl || '/duck-mascot.png')
    setGender(user.gender === 'FEMALE' ? 'FEMALE' : 'MALE')
    setShowPasswordSection(false)
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowOldPass(false)
    setShowNewPass(false)
    setConfirmLogout(false)
    setError('')
    setSuccess(false)
  }, [isOpen, user])

  // Lấy trạng thái mới nhất (genderLocked có thể đổi sau khi Host điểm danh / thu tiền)
  useEffect(() => {
    if (!isOpen) return
    const authToken = token || localStorage.getItem('smashflow_token')
    if (!authToken) return
    let cancelled = false
    api
      .get('/auth/me')
      .then((res) => {
        const { user: latest, token: latestToken } = useAuthStore.getState()
        if (!cancelled && res.data && latest) setAuth({ ...latest, ...res.data }, latestToken || authToken)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen || !user) return null

  const genderLocked = user.genderLocked === true
  const currentGender: 'MALE' | 'FEMALE' = user.gender === 'FEMALE' ? 'FEMALE' : 'MALE'
  const genderChanged = gender !== currentGender

  // Handle local image file upload & resize/compress to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, JPEG, WEBP)')
      return
    }

    // Max 10MB file limit
    if (file.size > 10 * 1024 * 1024) {
      setError('Dung lượng ảnh tối đa là 10MB!')
      return
    }

    setError('')
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new window.Image()
      img.onload = () => {
        // Center-crop & square resize to 128x128 (đủ nét cho màn hình Retina, dung lượng nhỏ)
        const canvas = document.createElement('canvas')
        const size = 128
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const minDim = Math.min(img.width, img.height)
          const sx = (img.width - minDim) / 2
          const sy = (img.height - minDim) / 2
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
          const base64 = canvas.toDataURL('image/jpeg', 0.7)
          setAvatarUrl(base64)
        }
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (showPasswordSection) {
      if (newPassword || oldPassword || confirmPassword) {
        if (!oldPassword) {
          setError('Vui lòng nhập mật khẩu hiện tại!')
          return
        }
        if (newPassword.length < 6) {
          setError('Mật khẩu mới phải có ít nhất 6 ký tự!')
          return
        }
        if (newPassword === oldPassword) {
          setError('Mật khẩu mới không được trùng với mật khẩu hiện tại!')
          return
        }
        if (newPassword !== confirmPassword) {
          setError('Mật khẩu xác nhận không trùng khớp!')
          return
        }
      }
    }

    setLoading(true)

    try {
      const authToken = token || localStorage.getItem('smashflow_token')
      const payload: any = {
        fullName: fullName.trim(),
        avatarUrl: avatarUrl,
        phone: user.phone,
      }

      if (showPasswordSection && newPassword.trim()) {
        payload.oldPassword = oldPassword
        payload.newPassword = newPassword.trim()
      }

      if (!genderLocked && genderChanged) {
        payload.gender = gender
      }

      const res = await api.put('/auth/profile', payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      })
      if (res.data) {
        // Đổi mật khẩu → server cấp token mới (token cũ bị vô hiệu); không lưu token vào object user
        const { token: newToken, ...profileData } = res.data as { token?: string } & Record<string, unknown>
        setAuth({ ...user, ...profileData }, newToken || authToken || '')
      }
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboards'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['session'] })
      setSuccess(true)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordSection(false)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 900)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Không thể cập nhật hồ sơ!')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setConfirmLogout(false)
    onClose()
    logout()
    navigate('/login')
  }

  const footer = (
    <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5">
      <button
        type="button"
        onClick={onClose}
        className="min-h-11 px-4 py-2.5 rounded-xl border border-slate-200 text-sm sm:text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
      >
        Hủy
      </button>
      <button
        type="submit"
        form="profile-modal-form"
        disabled={loading}
        className="min-h-11 px-6 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-sm sm:text-xs font-black rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Sparkles size={14} />
        <span>{loading ? 'Đang lưu...' : 'Lưu hồ sơ'}</span>
      </button>
    </div>
  )

  return (
    <BottomSheet open={isOpen} onClose={onClose} labelledBy="profile-modal-title" footer={footer} bodyClassName="space-y-5">
        <div className="text-center space-y-1 px-8">
          <h3 id="profile-modal-title" className="text-xl font-black text-slate-950">Chỉnh sửa hồ sơ & Avatar</h3>
          <p className="text-xs text-slate-500 font-medium">Thay đổi thông tin, ảnh đại diện và mật khẩu</p>
        </div>

        <form id="profile-modal-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold text-center">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-bold flex items-center justify-center gap-2">
              <Check size={16} />
              <span>Cập nhật hồ sơ & thông tin thành công!</span>
            </div>
          )}

          {/* Single Focused Avatar Preview & Direct Upload */}
          <div className="flex flex-col items-center justify-center gap-3 pt-1">
            <div className="relative group">
              <DuckMascot
                src={avatarUrl}
                size={90}
                rounded="3xl"
                className="shadow-xl border-2 border-slate-900/10 ring-4 ring-slate-100"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 p-2 bg-slate-950 hover:bg-slate-800 text-white rounded-2xl shadow-lg border-2 border-white transition active:scale-90"
                title="Tải ảnh mới từ điện thoại / máy tính"
                aria-label="Tải ảnh đại diện mới"
              >
                <Camera size={15} />
              </button>
            </div>

            {/* Hidden native file input for mobile / camera upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition active:scale-95 shadow-2xs"
              >
                <Upload size={13} className="text-slate-600" />
                <span>Tải ảnh từ thiết bị</span>
              </button>

              <button
                type="button"
                onClick={() => setAvatarUrl('/duck-mascot.png')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                  avatarUrl === '/duck-mascot.png'
                    ? 'bg-slate-950 border-slate-950 text-white shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Mascot CLB
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên của bạn</label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-3 text-slate-400" size={15} />
              <input
                type="text"
                name="name"
                autoComplete="name"
                aria-label="Họ và tên của bạn"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-3 sm:py-2.5 pl-10 pr-4 text-base sm:text-xs text-slate-950 font-bold focus:outline-none focus:border-slate-950 shadow-sm"
              />
            </div>
          </div>

          {/* Giới tính: tự sửa được khi chưa tham gia / thanh toán ca nào */}
          <fieldset>
            <legend className="block text-xs font-bold text-slate-700 mb-1">Giới tính</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Giới tính">
              {(['MALE', 'FEMALE'] as const).map((g) => {
                const selected = gender === g
                return (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={genderLocked}
                    onClick={() => setGender(g)}
                    className={`min-h-11 py-2.5 text-sm sm:text-xs font-bold rounded-xl border transition active:scale-95 disabled:active:scale-100 disabled:cursor-not-allowed ${
                      selected
                        ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    } ${genderLocked && !selected ? 'opacity-40' : ''}`}
                  >
                    {g === 'MALE' ? 'Nam' : 'Nữ'}
                  </button>
                )
              })}
            </div>
            {genderLocked ? (
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 flex items-start gap-1.5">
                <Lock size={12} className="mt-0.5 shrink-0 text-slate-400" />
                <span>Bạn đã tham gia ca đánh nên không thể tự đổi giới tính. Nếu chọn nhầm, hãy nhắn Host để được sửa giúp.</span>
              </p>
            ) : genderChanged ? (
              <p className="mt-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] leading-relaxed text-amber-800 font-medium">
                ⚠️ Giá các ca bạn đã đăng ký nhưng chưa thanh toán sẽ được tính lại theo giới tính mới. Sau khi tham gia ca đầu tiên, chỉ Host mới đổi được.
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-slate-500">Chọn nhầm lúc đăng ký? Bạn có thể sửa lại trước khi tham gia ca đầu tiên.</p>
            )}
          </fieldset>

          {/* Toggle Change Password Section */}
          <div className="pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="flex items-center justify-between w-full py-2 text-xs font-bold text-slate-700 hover:text-slate-950 transition"
            >
              <span className="flex items-center gap-1.5">
                <KeyRound size={14} className="text-amber-600" />
                <span>Đổi mật khẩu tài khoản</span>
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">
                {showPasswordSection ? 'Thu gọn ▲' : 'Mở rộng ▼'}
              </span>
            </button>

            {showPasswordSection && (
              <div className="space-y-3 pt-2 pb-1 animate-in fade-in duration-200">
                <div>
                  <label htmlFor="profile-old-password" className="block text-[11px] font-bold text-slate-600 mb-1">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-slate-400" size={14} />
                    <input
                      id="profile-old-password"
                      name="current-password"
                      type={showOldPass ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Nhập mật khẩu đang dùng"
                      className="w-full min-h-11 bg-slate-50 border border-slate-200 rounded-xl py-2.5 sm:py-2 pl-9 pr-12 text-base sm:text-xs text-slate-950 font-medium focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPass(!showOldPass)}
                      aria-label={showOldPass ? 'Ẩn mật khẩu hiện tại' : 'Hiện mật khẩu hiện tại'}
                      className="absolute right-0 top-0 h-full min-h-11 min-w-11 inline-flex items-center justify-center rounded-r-xl text-slate-400 hover:text-slate-600"
                    >
                      {showOldPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-new-password" className="block text-[11px] font-bold text-slate-600 mb-1">Mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-slate-400" size={14} />
                    <input
                      id="profile-new-password"
                      name="new-password"
                      type={showNewPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                      className="w-full min-h-11 bg-slate-50 border border-slate-200 rounded-xl py-2.5 sm:py-2 pl-9 pr-12 text-base sm:text-xs text-slate-950 font-medium focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      aria-label={showNewPass ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                      className="absolute right-0 top-0 h-full min-h-11 min-w-11 inline-flex items-center justify-center rounded-r-xl text-slate-400 hover:text-slate-600"
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-confirm-password" className="block text-[11px] font-bold text-slate-600 mb-1">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-slate-400" size={14} />
                    <input
                      id="profile-confirm-password"
                      name="confirm-new-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="w-full min-h-11 bg-slate-50 border border-slate-200 rounded-xl py-2.5 sm:py-2 pl-9 pr-4 text-base sm:text-xs text-slate-950 font-medium focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Đăng xuất (trên mobile chỉ có ở đây) — có bước xác nhận để tránh bấm nhầm */}
        <div className="pt-3 border-t border-slate-100">
          {confirmLogout ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-2.5">
              <p className="text-xs font-bold text-rose-800 text-center">Bạn chắc chắn muốn đăng xuất khỏi tài khoản này?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmLogout(false)}
                  className="min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm sm:text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Ở lại
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="min-h-11 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm sm:text-xs font-black transition active:scale-95"
                >
                  Xác nhận đăng xuất
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="w-full min-h-11 px-4 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-sm sm:text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <LogOut size={15} />
              <span>Đăng xuất</span>
            </button>
          )}
        </div>
    </BottomSheet>
  )
}
