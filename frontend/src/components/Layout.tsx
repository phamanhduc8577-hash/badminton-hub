import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar,
  Trophy,
  Gift,
  Users,
  User as UserIcon,
  Shield,
  LogOut,
  Plus,
  UserCheck,
  Settings,
} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { api } from '../lib/api'
import { LoyaltyReward } from '../types'
import { DuckMascot } from './DuckMascot'
import { BadmintonCourtBg } from './BadmintonCourtBg'
import { ProfileModal } from './ProfileModal'
import { LiquidNavbar, LiquidNavItem } from '@/components/ui/liquid-glass-navbar'

export const Layout: React.FC = () => {
  const { user, token, setAuth, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showProfileModal, setShowProfileModal] = useState(false)

  // Auto-sync fresh profile on app load if token exists
  useEffect(() => {
    if (token) {
      api
        .get('/auth/me')
        .then((res) => {
          if (res.data) {
            setAuth(res.data, token)
          }
        })
        .catch(() => {})
    }
  }, [token])

  // Lấy danh sách quà để hiện badge thông báo trên tab Đổi thưởng
  const { data: loyaltyRewards } = useQuery<LoyaltyReward[]>({
    queryKey: ['loyalty-rewards'],
    queryFn: async () => {
      const res = await api.get('/loyalty/my-rewards')
      return res.data
    },
    enabled: !!user,
    staleTime: 60_000,
  })

  const unclaimedRewardsCount = loyaltyRewards?.filter((r) => !r.isClaimed).length ?? 0

  const navItems: LiquidNavItem[] = [
    { label: 'Lịch ca đánh', icon: <Calendar size={15} />, fx: 'none' },
    { label: 'Bảng xếp hạng', icon: <Trophy size={15} />, fx: 'none' },
    { label: 'Thành viên', icon: <Users size={15} />, fx: 'none' },
    {
      label: unclaimedRewardsCount > 0 ? `Đổi thưởng (${unclaimedRewardsCount})` : 'Đổi thưởng',
      icon: <Gift size={15} />,
      fx: 'none',
    },
    ...(user?.role === 'HOST'
      ? [{ label: 'Host Panel', icon: <Shield size={15} />, fx: 'none' }]
      : []),
  ]

  const getActiveNavIndex = () => {
    if (location.pathname === '/leaderboard') return 1
    if (location.pathname === '/members') return 2
    if (location.pathname === '/loyalty') return 3
    if (location.pathname.startsWith('/host') && user?.role === 'HOST') return 4
    if (location.pathname === '/' || location.pathname.startsWith('/session')) return 0
    return 0
  }

  const handleNavChange = (index: number) => {
    const paths = [
      '/',
      '/leaderboard',
      '/members',
      '/loyalty',
      ...(user?.role === 'HOST' ? ['/host'] : []),
    ]
    if (paths[index] && paths[index] !== location.pathname) {
      navigate(paths[index])
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-slate-900 relative font-sans selection:bg-slate-900 selection:text-white">
      {/* High-End Clean Athletic Background */}
      <BadmintonCourtBg />

      {/* Editorial Sticky Header with Clean Contrast */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand & Duck Mascot */}
          <div
            className="flex items-center gap-2.5 sm:gap-3.5 cursor-pointer select-none group min-w-0"
            onClick={() => navigate('/')}
          >
            <div className="relative shrink-0">
              <DuckMascot size={44} rounded="xl" />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 group-hover:text-slate-700 transition truncate block">
                Cầu Lông Làng Địa Ngục
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links with Liquid Glass Water Effect */}
          <div className="hidden md:flex items-center">
            <LiquidNavbar
              items={navItems}
              active={getActiveNavIndex()}
              onChange={handleNavChange}
              tone="light"
            />
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3 shrink-0 ml-3">
            {user?.role === 'HOST' && (
              <button
                onClick={() => navigate('/host/create-session')}
                className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95"
              >
                <Plus size={15} />
                <span>Tạo ca mới</span>
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-3 sm:pl-3 sm:border-l border-slate-200">
                <div
                  onClick={() => setShowProfileModal(true)}
                  className="text-right hidden sm:block cursor-pointer group"
                  title="Bấm để chỉnh sửa hồ sơ & avatar"
                >
                  <span className="text-xs font-bold text-slate-900 block truncate max-w-[140px] group-hover:text-rose-600 transition">
                    {user.fullName}
                  </span>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {user.role}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {user.gender === 'FEMALE' ? 'Nữ' : 'Nam'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center cursor-pointer transition hover:scale-105"
                  title="Chỉnh sửa Avatar & Hồ sơ"
                  aria-label="Mở hồ sơ cá nhân"
                >
                  <DuckMascot
                    src={user.avatarUrl || (user.role === 'HOST' ? '/duck-host-sassy.png' : '/duck-mascot.png')}
                    size={38}
                    rounded="xl"
                    className="shadow-md border border-slate-200"
                  />
                </button>

                {/* Trên mobile nút đăng xuất nằm trong popup hồ sơ (có bước xác nhận) để tránh bấm nhầm */}
                <button
                  type="button"
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                  className="hidden sm:inline-flex p-2.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 transition shadow-sm"
                  title="Đăng xuất"
                  aria-label="Đăng xuất"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (location.pathname === '/login') {
                    const loginForm = document.getElementById('auth-form-card')
                    if (loginForm) {
                      loginForm.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  } else {
                    navigate('/login')
                  }
                }}
                className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer"
              >
                Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-14 relative z-10">
        <Outlet />
      </main>

      {/* Profile & Avatar Editing Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Clean Minimalist Sports Footer */}
      <footer className="hidden md:block relative z-10 border-t border-slate-200 bg-white/80 backdrop-blur-md py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <DuckMascot size={28} rounded="xl" />
            <span className="font-bold text-slate-800">
              CLB Cầu Lông Làng Địa Ngục
            </span>
          </div>
          <p className="text-slate-500 font-medium">
            Hệ thống quản lý ca đánh & bắt kèo cầu lông
          </p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation (chừa vùng thanh home iPhone) */}
      <nav
        aria-label="Điều hướng chính"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 flex items-stretch justify-around gap-1 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] px-2 z-40 shadow-xl"
      >
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex-1 min-w-0 min-h-11 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
              isActive ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          <Calendar size={18} />
          <span>Lịch ca</span>
        </NavLink>

        <NavLink
          to="/leaderboard"
          className={({ isActive }) =>
            `flex-1 min-w-0 min-h-11 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
              isActive ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          <Trophy size={18} />
          <span>Xếp hạng</span>
        </NavLink>

        <NavLink
          to="/members"
          className={({ isActive }) =>
            `flex-1 min-w-0 min-h-11 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
              isActive ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          <Users size={18} />
          <span>Thành viên</span>
        </NavLink>

        <NavLink
          to="/loyalty"
          className={({ isActive }) =>
            `flex-1 min-w-0 min-h-11 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
              isActive ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          <div className="relative">
            <Gift size={18} />
            {unclaimedRewardsCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-3.5 h-3.5 px-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                {unclaimedRewardsCount}
              </span>
            )}
          </div>
          <span>Đổi thưởng</span>
        </NavLink>

        {user?.role === 'HOST' ? (
          <NavLink
            to="/host"
            className={({ isActive }) =>
              `flex-1 min-w-0 min-h-11 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
                isActive ? 'text-rose-600 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`
            }
          >
            <Shield size={18} />
            <span>Host</span>
          </NavLink>
        ) : user ? (
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="flex-1 min-w-0 min-h-11 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition"
          >
            <DuckMascot
              src={user.avatarUrl || '/duck-mascot.png'}
              size={18}
              rounded="full"
              className="border border-slate-300 shadow-2xs"
            />
            <span className="font-bold text-slate-900 truncate max-w-[65px]">
              {user.fullName ? user.fullName.split(' ').slice(-1)[0] : 'Cá nhân'}
            </span>
          </button>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `flex-1 min-w-0 min-h-11 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
                isActive ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`
            }
          >
            <UserIcon size={18} />
            <span>Tài khoản</span>
          </NavLink>
        )}
      </nav>
    </div>
  )
}
