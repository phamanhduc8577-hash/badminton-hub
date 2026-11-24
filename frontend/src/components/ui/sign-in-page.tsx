'use client'

import React, { useState } from 'react'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export interface SignInPageProps {
  heroImage?: string
  heroTagline?: string
  heroTitle?: string
  heroSubtitle?: string
  onLoginSubmit?: (data: { phoneOrEmail: string; password: string; rememberMe: boolean }) => void
  onGoogleLogin?: () => void
  onGithubLogin?: () => void
  onForgotPassword?: () => void
  onSignUpClick?: () => void
  isLoading?: boolean
  errorMessage?: string
}

export function LoginPage({
  heroImage = 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=1600&auto=format&fit=crop',
  heroTagline = 'KENTO MOMOTA • TOURNAMENT EDITION',
  heroTitle = 'Bản Lĩnh Trên Từng Điểm Cầu',
  heroSubtitle = 'Hệ thống quản lý ca đánh, xếp hạng Elo & kết nối cộng đồng Cầu Lông Làng Địa Ngục.',
  onLoginSubmit,
  onForgotPassword,
  onSignUpClick,
  isLoading = false,
  errorMessage = '',
}: SignInPageProps) {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    phoneOrEmail: '',
    password: '',
    rememberMe: false,
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (onLoginSubmit) {
      onLoginSubmit(formData)
    } else {
      console.log('Login submitted:', formData)
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col lg:flex-row">
      {/* Left Panel - Real Athletic Image Section */}
      <div className="relative w-full lg:w-1/2 min-h-[340px] lg:min-h-screen overflow-hidden bg-slate-950 flex flex-col justify-between p-6 sm:p-10">
        {/* Back Button */}
        <div className="relative z-20">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-10 h-10 bg-slate-950/60 hover:bg-slate-900 border border-white/20 backdrop-blur-md rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer text-white shadow-lg"
            title="Quay lại trang chủ"
            aria-label="Quay lại trang chủ"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Real High-Resolution Sports Photography */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Badminton Athletic Focus"
            className="w-full h-full object-cover object-center filter brightness-[0.78] contrast-[1.12]"
            loading="eager"
          />
          {/* Subtle Editorial Gradient Overlay for Depth and Contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/50 via-transparent to-transparent hidden lg:block" />
        </div>

        {/* Left Bottom Editorial Title & Inspiration */}
        <div className="relative z-20 space-y-2.5 max-w-lg mt-auto pt-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-mono font-bold tracking-wider backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{heroTagline}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
            {heroTitle}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed font-medium">
            {heroSubtitle}
          </p>
        </div>
      </div>

      {/* Right Panel - Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-6 py-10 sm:px-12 lg:px-16">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Đăng nhập tài khoản
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={onSignUpClick ? onSignUpClick : () => navigate('/login?tab=register')}
                className="text-emerald-700 hover:text-emerald-800 font-bold underline transition cursor-pointer"
              >
                Đăng ký thành viên
              </button>
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold">
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone or Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Số điện thoại / Email
              </label>
              <input
                type="text"
                name="phoneOrEmail"
                value={formData.phoneOrEmail}
                onChange={handleInputChange}
                placeholder="Nhập số điện thoại của bạn..."
                className="w-full px-4 py-3 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-950 focus:border-slate-950 outline-none text-sm text-slate-900 transition font-medium"
                required
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Nhập mật khẩu..."
                  className="w-full px-4 py-3 pr-12 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-950 focus:border-slate-950 outline-none text-sm text-slate-900 transition font-medium"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-slate-600" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me + Forgot Password */}
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center space-x-2 text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-slate-950 border-slate-300 rounded focus:ring-slate-950 cursor-pointer"
                />
                <span className="font-medium">Ghi nhớ đăng nhập</span>
              </label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs font-bold text-slate-600 hover:text-slate-950 transition cursor-pointer"
              >
                Quên mật khẩu?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-12 bg-slate-950 hover:bg-slate-800 disabled:opacity-60 text-white py-3 px-4 rounded-xl font-bold text-sm transition active:scale-95 shadow-md flex items-center justify-center cursor-pointer"
            >
              {isLoading ? 'Đang xử lý...' : 'Đăng nhập ngay'}
            </button>

            {/* Quick Helper Note */}
            <div className="pt-4 border-t border-slate-200 text-center">
              <p className="text-xs text-slate-500 font-medium">
                Cần hỗ trợ đặt sân hoặc cấp quyền Host?{' '}
                <span className="font-bold text-slate-800">Liên hệ Zalo BQL CLB</span>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
