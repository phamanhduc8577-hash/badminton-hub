import React, { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/useAuthStore'
import { api } from '../lib/api'
import { DuckMascot } from './DuckMascot'
import { X, User as UserIcon, Upload, Check, Sparkles, Camera, Lock, KeyRound, Eye, EyeOff } from 'lucide-react'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, setAuth, token } = useAuthStore()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(user?.fullName || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '/duck-mascot.png')
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOldPass, setShowOldPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Sync state with fresh user props whenever modal opens
  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '')
      setAvatarUrl(user.avatarUrl || '/duck-mascot.png')
      setShowPasswordSection(false)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }, [isOpen, user])

  if (!isOpen || !user) return null

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
        // Center-crop & square resize to 256x256
        const canvas = document.createElement('canvas')
        const size = 256
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const minDim = Math.min(img.width, img.height)
          const sx = (img.width - minDim) / 2
          const sy = (img.height - minDim) / 2
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
          const base64 = canvas.toDataURL('image/jpeg', 0.8)
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

      const res = await api.put('/auth/profile', payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      })
      if (res.data) {
        setAuth({ ...user, ...res.data }, authToken || '')
      }
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <X size={18} />
        </button>

        <div className="text-center space-y-1">
          <h3 className="text-xl font-black text-slate-950">Chỉnh sửa hồ sơ & Avatar</h3>
          <p className="text-xs text-slate-500 font-medium">Thay đổi thông tin, ảnh đại diện và mật khẩu</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-950 font-bold focus:outline-none focus:border-slate-950 shadow-sm"
              />
            </div>
          </div>

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
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input
                      type={showOldPass ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Nhập mật khẩu đang dùng"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-9 text-xs text-slate-950 font-medium focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPass(!showOldPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showOldPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-9 text-xs text-slate-950 font-medium focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-950 font-medium focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              <Sparkles size={14} />
              <span>{loading ? 'Đang lưu...' : 'Lưu hồ sơ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
