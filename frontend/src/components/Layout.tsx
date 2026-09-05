import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Calendar,
  Trophy,
  Gift,
  Users,
  User as UserIcon,
  Shield,
  LogOut,
  Plus,
  Flame,
  UserCheck,
  Settings,
} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { api } from '../lib/api'
import { DuckMascot } from './DuckMascot'
import { BadmintonCourtBg } from './BadmintonCourtBg'
import { ProfileModal } from './ProfileModal'

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

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F6F9] text-slate-900 relative font-sans selection:bg-slate-900 selection:text-white">
      {/* High-End Editorial Background with Sharp Badminton Backdrop */}
      <BadmintonCourtBg />

      {/* Editorial Sticky Header with Enhanced Contrast & Sharp Border */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-2xl border-b border-slate-200/90 shadow-sm shadow-slate-900/[0.03] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand & Duck Mascot */}
          <div
            className="flex items-center gap-3.5 cursor-pointer select-none group"
            onClick={() => navigate('/')}
          >
            <div className="relative">
              <DuckMascot size={44} rounded="xl" />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tight text-slate-950 group-hover:text-slate-700 transition">
                  SmashFlow
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-900 text-white tracking-wider">
                  Pro
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold mt-0.5">
                <Flame size={12} className="text-rose-600" />
                <span>CLB Làng Địa Ngục • Host by anhduck</span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  isActive
                    ? 'bg-slate-950 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-white/80'
                }`
              }
            >
              <Calendar size={15} />
              <span>Lịch ca đánh</span>
            </NavLink>

            <NavLink
              to="/leaderboard"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  isActive
                    ? 'bg-slate-950 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-white/80'
                }`
              }
            >
              <Trophy size={15} />
              <span>Bảng xếp hạng</span>
            </NavLink>

            <NavLink
              to="/members"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  isActive
                    ? 'bg-slate-950 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-white/80'
                }`
              }
            >
              <Users size={15} />
              <span>Thành viên</span>
            </NavLink>

            <NavLink
              to="/loyalty"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  isActive
                    ? 'bg-slate-950 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-white/80'
                }`
              }
            >
              <Gift size={15} />
              <span>Đổi thưởng</span>
            </NavLink>

            {user?.role === 'HOST' && (
              <NavLink
                to="/host"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                    isActive || location.pathname.startsWith('/host')
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/80'
                  }`
                }
              >
                <Shield size={15} />
                <span>Host Panel</span>
              </NavLink>
            )}
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
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
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div
                  onClick={() => setShowProfileModal(true)}
                  className="text-right hidden sm:block cursor-pointer group"
                  title="Bấm để chỉnh sửa hồ sơ & avatar"
                >
                  <span className="text-xs font-black text-slate-950 block truncate max-w-[140px] group-hover:text-rose-600 transition">
                    {user.fullName}
                  </span>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <span className="text-[10px] px-2 py-0.2 rounded font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      {user.role}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {user.gender === 'FEMALE' ? 'Nữ' : 'Nam'}
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => setShowProfileModal(true)}
                  className="cursor-pointer transition hover:scale-105"
                  title="Chỉnh sửa Avatar & Hồ sơ"
                >
                  <DuckMascot
                    src={user.avatarUrl || (user.role === 'HOST' ? '/duck-host-sassy.png' : '/duck-mascot.png')}
                    size={38}
                    rounded="xl"
                    className="shadow-md border border-slate-200"
                  />
                </div>

                <button
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                  className="p-2.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 transition shadow-sm"
                  title="Đăng xuất"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95"
              >
                Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-28 md:pb-14 relative z-10">
        <Outlet />
      </main>

      {/* Profile & Avatar Editing Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Clean Minimalist Editorial Footer */}
      <footer className="relative z-10 border-t border-slate-200/90 bg-white/80 backdrop-blur-md py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DuckMascot size={32} rounded="xl" />
            <div className="text-left">
              <span className="font-black text-slate-950 block">
                SmashFlow Pro Edition
              </span>
              <span className="text-[11px] text-slate-400">Hệ sinh thái cầu lông thông minh CLB Làng Địa Ngục</span>
            </div>
          </div>
          <p className="text-slate-500 font-medium">
            Designed & Engineered with precision by <span className="font-bold text-slate-950">anhduck</span>
          </p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 flex justify-around py-3 px-2 z-40 shadow-xl">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[11px] font-semibold transition ${
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
            `flex flex-col items-center gap-1 text-[11px] font-semibold transition ${
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
            `flex flex-col items-center gap-1 text-[11px] font-semibold transition ${
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
            `flex flex-col items-center gap-1 text-[11px] font-semibold transition ${
              isActive ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          <Gift size={18} />
          <span>Đổi thưởng</span>
        </NavLink>

        {user?.role === 'HOST' ? (
          <NavLink
            to="/host"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] font-semibold transition ${
                isActive ? 'text-rose-600 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`
            }
          >
            <Shield size={18} />
            <span>Host</span>
          </NavLink>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] font-semibold transition ${
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
