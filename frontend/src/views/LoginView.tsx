import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
import { BadmintonHeroEditorial } from '../components/BadmintonHeroEditorial'
import { BottomSheet } from '../components/BottomSheet'
import { useToast } from '../components/ToastProvider'
import {
  LogIn,
  UserPlus,
  Phone,
  Lock,
  User as UserIcon,
  CheckCircle2,
  Upload,
  Camera,
  Send,
  ArrowLeft,
} from 'lucide-react'

export const LoginView: React.FC = () => {
  const { user, token, setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Chỉ chấp nhận đường dẫn nội bộ (chặn "//evil.com", "https://…") và không quay lại chính /login
  const rawRedirect = searchParams.get('redirect') || '/'
  const redirectPath =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') && !rawRedirect.startsWith('/\\') && !rawRedirect.startsWith('/login')
      ? rawRedirect
      : '/'
  const { showToast } = useToast()

  // If already logged in, redirect to target or home
  useEffect(() => {
    if (user && token) {
      navigate(redirectPath, { replace: true })
    }
  }, [user, token, navigate, redirectPath])

  const [isRegister, setIsRegister] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE')
  const [membershipChoice, setMembershipChoice] = useState<'FIXED' | 'CASUAL'>('CASUAL')
  const [avatarUrl, setAvatarUrl] = useState('/duck-mascot.png')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  // Có lỗi mới → cuộn tới thông báo lỗi (cạnh nút gửi) để người dùng mobile thấy ngay
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }, [error])

  // Handle local image file upload & resize/compress to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, JPEG, WEBP)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Dung lượng ảnh tối đa là 10MB!')
      return
    }

    setError('')
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 128 // 128x128 đủ nét trên màn hình Retina/OLED mà dung lượng chỉ vài KB
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const minDim = Math.min(img.width, img.height)
          const sx = (img.width - minDim) / 2
          const sy = (img.height - minDim) / 2
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
          const base64 = canvas.toDataURL('image/jpeg', 0.7) // Chất lượng 70%, dung lượng chỉ vài KB
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
    setForgotSuccess('')
    setLoading(true)

    try {
      if (isForgotPassword) {
        const cleanPhone = phone.trim()
        const phoneRegex = /^(0[35789])[0-9]{8}$/
        if (!phoneRegex.test(cleanPhone)) {
          setError('Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 số (VD: 09..., 03..., 05..., 07..., 08...).')
          setLoading(false)
          return
        }
        const res = await api.post('/auth/forgot-password', { phone: cleanPhone })
        setForgotSuccess(res.data?.message || 'Đã gửi yêu cầu cấp lại mật khẩu đến Host qua Telegram!')
      } else if (isRegister) {
        const cleanPhone = phone.trim()
        const phoneRegex = /^(0[35789])[0-9]{8}$/
        if (!phoneRegex.test(cleanPhone)) {
          setError('Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 số (VD: 09..., 03..., 05..., 07..., 08...).')
          setLoading(false)
          return
        }

        if (password.trim().length < 6) {
          setError('Mật khẩu phải có ít nhất 6 ký tự!')
          setLoading(false)
          return
        }
        const payloadAvatar = avatarUrl && avatarUrl.trim() !== '' ? avatarUrl : '/duck-mascot.png'
        const res = await api.post('/auth/register', {
          phone: cleanPhone,
          fullName: fullName.trim(),
          password: password,
          gender,
          requestedMembershipType: membershipChoice,
          avatarUrl: payloadAvatar,
        })
        setAuth(res.data, res.data.token)

        if (membershipChoice === 'FIXED') {
          showToast('Đăng ký thành công! Yêu cầu "Cố định" đang chờ Host duyệt.', 'info')
        } else {
          showToast('Đăng ký tài khoản thành công!', 'success')
        }
        navigate(redirectPath)
      } else {
        const res = await api.post('/auth/login', {
          phone: phone.trim(),
          password: password,
        })
        setAuth(res.data, res.data.token)
        navigate(redirectPath)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Có lỗi xảy ra, vui lòng thử lại!')
    } finally {
      setLoading(false)
    }
  }

  const renderAuthContent = (isMobileModal?: boolean) => (
    <>
      {/* Top Segmented Controls: Đăng nhập / Đăng ký */}
      {!isForgotPassword ? (
        <div className="flex p-1 bg-slate-100/90 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false)
              setError('')
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              !isRegister
                ? 'bg-slate-950 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <LogIn size={14} />
            <span>Đăng nhập</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true)
              setError('')
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              isRegister
                ? 'bg-slate-950 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <UserPlus size={14} />
            <span>Đăng ký</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => {
              setIsForgotPassword(false)
              setError('')
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-950 transition cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>Quay lại</span>
          </button>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hỗ trợ tài khoản</span>
        </div>
      )}

      {/* Header Title (đảm bảo test tìm thấy "Đăng nhập hệ thống") */}
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          {isForgotPassword
            ? 'Khôi phục mật khẩu'
            : isRegister
            ? 'Đăng ký thành viên'
            : 'Đăng nhập hệ thống'}
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          {isForgotPassword
            ? 'Gửi yêu cầu xác nhận tới Telegram của Host'
            : isRegister
            ? 'Điền thông tin để tạo tài khoản tham gia CLB'
            : 'Chào mừng trở lại! Vui lòng đăng nhập để tiếp tục'}
        </p>
      </div>

      {forgotSuccess ? (
        <div className="space-y-4 py-2">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>Yêu cầu đã được gửi thành công!</span>
            </div>
            <p className="text-xs text-emerald-900 leading-relaxed font-medium">
              {forgotSuccess}
            </p>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-emerald-200/60">
              💡 Host đã nhận được thông báo qua Telegram. Vui lòng liên hệ Host để nhận mật khẩu tạm thời.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsForgotPassword(false)
              setForgotSuccess('')
              setError('')
            }}
            className="w-full min-h-11 py-2.5 bg-slate-950 hover:bg-slate-800 font-bold text-white text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>Quay lại Đăng nhập</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && !isForgotPassword && (
            <div>
              <label htmlFor={isMobileModal ? 'auth-fullname-m' : 'auth-fullname'} className="block text-xs font-bold text-slate-700 mb-1.5">
                Họ và tên
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                <input
                  id={isMobileModal ? 'auth-fullname-m' : 'auth-fullname'}
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-11 bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-2xs font-semibold"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor={isMobileModal ? 'auth-phone-m' : 'auth-phone'} className="block text-xs font-bold text-slate-700 mb-1.5">
              Số điện thoại
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
              <input
                id={isMobileModal ? 'auth-phone-m' : 'auth-phone'}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="Nhập số điện thoại của bạn..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-11 bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-2xs font-semibold"
              />
            </div>
          </div>

          {!isForgotPassword && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor={isMobileModal ? 'auth-password-m' : 'auth-password'} className="block text-xs font-bold text-slate-700">
                  Mật khẩu
                </label>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true)
                      setError('')
                      setForgotSuccess('')
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-950 transition cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                <input
                  id={isMobileModal ? 'auth-password-m' : 'auth-password'}
                  name="password"
                  type="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-11 bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-2xs font-semibold"
                />
              </div>
            </div>
          )}

          {isRegister && !isForgotPassword && (
            <>
              {/* Giới tính */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Giới tính</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGender('MALE')}
                    className={`min-h-11 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      gender === 'MALE'
                        ? 'bg-slate-950 border-slate-950 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Nam
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('FEMALE')}
                    className={`min-h-11 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      gender === 'FEMALE'
                        ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Nữ</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${gender === 'FEMALE' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'}`}>
                      Trợ giá
                    </span>
                  </button>
                </div>
              </div>

              {/* Hình thức thành viên */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Hình thức tham gia</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMembershipChoice('CASUAL')}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      membershipChoice === 'CASUAL'
                        ? 'bg-slate-950 border-slate-950 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-xs">Vãng lai</span>
                    <span className={`text-[11px] font-medium mt-0.5 ${membershipChoice === 'CASUAL' ? 'text-slate-300' : 'text-slate-500'}`}>
                      Đánh linh hoạt theo buổi
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMembershipChoice('FIXED')}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      membershipChoice === 'FIXED'
                        ? 'bg-slate-950 border-slate-950 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">Cố định</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${membershipChoice === 'FIXED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800'}`}>
                        Giá ưu đãi
                      </span>
                    </div>
                    <span className={`text-[11px] font-medium mt-0.5 ${membershipChoice === 'FIXED' ? 'text-slate-300' : 'text-slate-500'}`}>
                      Sinh hoạt định kỳ CLB
                    </span>
                  </button>
                </div>
              </div>

              {/* Avatar Picker & Upload */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700">Ảnh đại diện</label>
                <div className="flex items-center gap-3.5 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="relative group shrink-0">
                    <DuckMascot
                      src={avatarUrl}
                      size={56}
                      rounded="2xl"
                      className="shadow-sm border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1.5 -right-1.5 min-h-7 min-w-7 inline-flex items-center justify-center bg-slate-950 text-white rounded-lg shadow-xs border-2 border-white cursor-pointer"
                      title="Tải ảnh từ máy"
                      aria-label="Tải ảnh đại diện từ máy"
                    >
                      <Camera size={13} />
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full min-h-9 py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                    >
                      <Upload size={13} className="text-slate-600" />
                      <span className="truncate">Tải ảnh từ máy / điện thoại</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAvatarUrl('/duck-mascot.png')}
                      className="w-full text-[11px] font-bold text-slate-500 hover:text-slate-900 transition cursor-pointer text-center"
                    >
                      Dùng Mascot mặc định
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Error Banner */}
          {error && (
            <div
              ref={errorRef}
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold scroll-mt-24"
            >
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 py-3 bg-slate-950 hover:bg-slate-800 font-bold text-white text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 mt-4 cursor-pointer"
          >
            {isForgotPassword ? (
              <>
                <Send size={15} />
                <span>{loading ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu tới Host'}</span>
              </>
            ) : isRegister ? (
              <>
                <UserPlus size={15} />
                <span>{loading ? 'Đang xử lý...' : 'Tạo tài khoản'}</span>
              </>
            ) : (
              <>
                <LogIn size={15} />
                <span>{loading ? 'Đang xử lý...' : 'Đăng nhập ngay'}</span>
              </>
            )}
          </button>
        </form>
      )}
    </>
  )

  return (
    <div className="min-h-[82vh] flex items-center justify-center py-6 sm:py-10">
      <div className="w-full max-w-5xl flex flex-col lg:grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Real Athletic Badminton Showcase (Desktop lg:col-span-6, Mobile full width) */}
        <div className="w-full lg:col-span-6 space-y-4 text-left">
          {/* Authentic Badminton Hero Panel */}
          <div>
            <BadmintonHeroEditorial />
          </div>

          {/* Mobile Action Buttons: Bấm mở BottomSheet mượt mà */}
          <div className="lg:hidden w-full pt-1 space-y-2.5">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false)
                setIsForgotPassword(false)
                setError('')
                setIsSheetOpen(true)
              }}
              className="w-full min-h-12 py-3 px-4 bg-slate-950 hover:bg-slate-900 active:scale-[0.98] text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogIn size={16} />
              <span>Vào ca đấu / Đăng nhập</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRegister(true)
                setIsForgotPassword(false)
                setError('')
                setIsSheetOpen(true)
              }}
              className="w-full min-h-11 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 active:scale-[0.98] text-slate-800 font-bold text-xs rounded-2xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <UserPlus size={15} className="text-slate-600" />
              <span>Chưa có tài khoản? Đăng ký ngay</span>
            </button>
          </div>
        </div>

        {/* Right Column: Modern Athletic Form Card (Desktop lg:col-span-6, Ẩn trên mobile) */}
        <div id="auth-form-card" className="w-full hidden lg:block lg:col-span-6 scroll-mt-24">
          <div className="saas-card rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-xl border border-slate-200/90 bg-white/98">
            {renderAuthContent(false)}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet: Trượt từ đáy màn hình lên, chống bàn phím che form */}
      <BottomSheet
        open={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <DuckMascot size={22} rounded="xl" />
            <span className="text-sm font-black text-slate-900">Làng Địa Ngục</span>
          </div>
        }
      >
        <div className="py-2 space-y-4">
          {renderAuthContent(true)}
        </div>
      </BottomSheet>
    </div>
  )
}
