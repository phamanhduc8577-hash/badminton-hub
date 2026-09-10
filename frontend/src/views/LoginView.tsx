import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../store/useAuthStore'
import { DuckMascot } from '../components/DuckMascot'
import { useToast } from '../components/ToastProvider'
import { notifyNewUserRegisteredDirect } from '../lib/telegram'
import {
  LogIn,
  UserPlus,
  Phone,
  Lock,
  User as UserIcon,
  ShieldCheck,
  Trophy,
  QrCode,
  CheckCircle2,
  Upload,
  Camera,
  KeyRound,
  Send,
  ArrowLeft,
  Gift,
  Coins,
  Swords,
} from 'lucide-react'

export const LoginView: React.FC = () => {
  const { user, token, setAuth } = useAuthStore()
  const navigate = useNavigate()
  const { showToast } = useToast()

  // If already logged in, redirect to home
  useEffect(() => {
    if (user && token) {
      navigate('/', { replace: true })
    }
  }, [user, token, navigate])

  const [isRegister, setIsRegister] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
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

        // Instant direct Telegram notification pipeline
        notifyNewUserRegisteredDirect(
          fullName.trim(),
          cleanPhone,
          gender,
          membershipChoice
        ).catch(() => {})

        if (membershipChoice === 'FIXED') {
          showToast('Đăng ký thành công! Yêu cầu "Cố định" đang chờ Host duyệt.', 'info')
        } else {
          showToast('Đăng ký tài khoản thành công!', 'success')
        }
        navigate('/')
      } else {
        const res = await api.post('/auth/login', {
          phone: phone.trim(),
          password: password,
        })
        setAuth(res.data, res.data.token)
        navigate('/')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Có lỗi xảy ra, vui lòng thử lại!')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Side: Brand Showcase & Value Props (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-center gap-4">
            <DuckMascot size={64} rounded="2xl" />
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider">
                <span>SmashFlow Portal</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-1">CLB Làng Địa Ngục</h2>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Quản trị CLB cầu lông & <br />
              <span className="underline decoration-rose-500/40 decoration-4 underline-offset-8">
                điểm danh thông minh
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Hệ sinh thái cầu lông thông minh: Tích điểm chuyên cần đổi quà, vinh danh leo rank Thách Đấu, ghép sân cân bằng trình độ và minh bạch chi phí từng ca.
            </p>
          </div>

          {/* Value Props Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold">
                <Gift size={16} />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Tích điểm chuyên cần</h4>
              <p className="text-slate-600 text-[11px]">Đổi nước tăng lực & voucher giảm giá slot ca đánh.</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                <Trophy size={16} />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Leo Rank & Vinh danh</h4>
              <p className="text-slate-600 text-[11px]">Bảng xếp hạng chiến thần và danh hiệu Thách Đấu.</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold">
                <Swords size={16} />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Ghép sân thông minh</h4>
              <p className="text-slate-600 text-[11px]">Cân bằng trình độ 100%, bắt kèo đấu sòng phẳng.</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
                <Coins size={16} />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Chia tiền tự động</h4>
              <p className="text-slate-600 text-[11px]">Hạch toán chi phí sân, cầu, nước rõ ràng từng buổi.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Card Form (6 cols) */}
        <div className="lg:col-span-6">
          <div className="saas-card rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {isForgotPassword
                  ? 'Quên mật khẩu'
                  : isRegister
                  ? 'Đăng ký thành viên'
                  : 'Đăng nhập hệ thống'}
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                {isForgotPassword
                  ? 'Nhập số điện thoại để gửi yêu cầu cấp lại mật khẩu đến Telegram của Host'
                  : isRegister
                  ? 'Tạo tài khoản để tham gia ca đánh và tích điểm quà tặng'
                  : 'Nhập thông tin tài khoản để truy cập'}
              </p>
            </div>

            {forgotSuccess ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <span>Yêu cầu đã được gửi thành công!</span>
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    {forgotSuccess}
                  </p>
                  <p className="text-[11px] text-slate-600 pt-2 border-t border-emerald-200/60">
                    💡 Host đã nhận được thông báo trên Telegram. Bạn hãy liên hệ Host hoặc kiểm tra tin nhắn với Host để lấy mật khẩu tạm thời.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false)
                    setForgotSuccess('')
                    setError('')
                  }}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 font-bold text-white text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
                >
                  <ArrowLeft size={16} />
                  <span>Quay lại trang Đăng nhập</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold">
                    {error}
                  </div>
                )}

                {isRegister && !isForgotPassword && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Họ và tên của bạn</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                      <input
                        type="text"
                        required
                        placeholder="Nguyễn Văn A"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-sm font-semibold"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Số điện thoại</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                    <input
                      type="tel"
                      required
                      placeholder="Nhập số điện thoại của bạn..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-sm font-semibold"
                    />
                  </div>
                </div>

                {!isForgotPassword && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">Mật khẩu</label>
                      {!isRegister && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true)
                            setError('')
                            setForgotSuccess('')
                          }}
                          className="text-[11px] font-bold text-slate-500 hover:text-slate-900 transition"
                        >
                          Quên mật khẩu?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                      <input
                        type="password"
                        required
                        placeholder="••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-sm font-semibold"
                      />
                    </div>
                  </div>
                )}

                {isRegister && !isForgotPassword && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Giới tính</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setGender('MALE')}
                          className={`py-2.5 text-xs font-bold rounded-xl border transition ${
                            gender === 'MALE'
                              ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Nam
                        </button>
                        <button
                          type="button"
                          onClick={() => setGender('FEMALE')}
                          className={`py-2.5 text-xs font-bold rounded-xl border transition ${
                            gender === 'FEMALE'
                              ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Nữ (Trợ giá)
                        </button>
                      </div>
                    </div>

                    {/* Lựa chọn phân loại thành viên */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">Hình thức tham gia CLB</label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setMembershipChoice('CASUAL')}
                          className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                            membershipChoice === 'CASUAL'
                              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-200 text-amber-950'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs">🟡 Vãng lai</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                              Tự do
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-tight">
                            Đánh linh hoạt theo buổi, giá slot vãng lai.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMembershipChoice('FIXED')}
                          className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                            membershipChoice === 'FIXED'
                              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-200 text-emerald-950'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs">🟢 Cố định</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                              Ưu đãi
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-tight">
                            Giá slot CLB rẻ hơn, cần Host duyệt chính thức.
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Direct Avatar Picker & Upload */}
                    <div className="space-y-2 pt-1">
                      <label className="block text-xs font-bold text-slate-700">Ảnh đại diện (Avatar)</label>
                      <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                        <div className="relative group shrink-0">
                          <DuckMascot
                            src={avatarUrl}
                            size={64}
                            rounded="2xl"
                            className="shadow-md border border-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute -bottom-1 -right-1 p-1.5 bg-slate-950 text-white rounded-xl shadow border border-white"
                            title="Tải ảnh từ máy"
                          >
                            <Camera size={12} />
                          </button>
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />

                        <div className="space-y-1.5 flex-1">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 flex items-center justify-center gap-1.5 shadow-2xs transition"
                          >
                            <Upload size={14} className="text-slate-600" />
                            <span>Tải ảnh từ máy / điện thoại</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAvatarUrl('/duck-mascot.png')}
                            className="w-full py-1 text-[11px] font-bold text-slate-500 hover:text-slate-900 transition"
                          >
                            Dùng Mascot mặc định
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 font-bold text-white text-xs rounded-xl shadow flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 mt-4"
                >
                  {isForgotPassword ? (
                    <>
                      <Send size={16} />
                      <span>{loading ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu tới Telegram của Host'}</span>
                    </>
                  ) : isRegister ? (
                    <>
                      <UserPlus size={16} />
                      <span>{loading ? 'Đang xử lý...' : 'Tạo tài khoản ngay'}</span>
                    </>
                  ) : (
                    <>
                      <LogIn size={16} />
                      <span>{loading ? 'Đang xử lý...' : 'Đăng nhập vào hệ thống'}</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {!forgotSuccess && (
              <div className="text-center space-y-2">
                {isForgotPassword ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false)
                      setError('')
                    }}
                    className="text-xs text-slate-900 hover:underline font-bold flex items-center justify-center gap-1 mx-auto"
                  >
                    <ArrowLeft size={14} />
                    <span>Quay lại Đăng nhập</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(!isRegister)
                      setError('')
                    }}
                    className="text-xs text-slate-900 hover:underline font-bold"
                  >
                    {isRegister ? 'Đã có tài khoản? Đăng nhập ngay' : 'Chưa có tài khoản? Đăng ký thành viên'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
