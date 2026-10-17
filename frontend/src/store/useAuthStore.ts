import { create } from 'zustand'
import { User } from '../types'
import { queryClient } from '../lib/queryClient'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

/**
 * Check if a JWT token is expired before initializing state
 */
export function isTokenValid(token: string | null): boolean {
  if (!token) return false
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (!payload.exp) return true
    // If expiration time is in the past (with 5s buffer), token is expired
    return payload.exp * 1000 > Date.now() + 5000
  } catch {
    return false
  }
}

function getInitialState(): { user: User | null; token: string | null } {
  const token = localStorage.getItem('smashflow_token')
  const userStr = localStorage.getItem('smashflow_user')

  if (!token || !userStr || !isTokenValid(token)) {
    localStorage.removeItem('smashflow_token')
    localStorage.removeItem('smashflow_user')
    return { user: null, token: null }
  }

  try {
    return { user: JSON.parse(userStr), token }
  } catch {
    localStorage.removeItem('smashflow_token')
    localStorage.removeItem('smashflow_user')
    return { user: null, token: null }
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),
  setAuth: (user, token) => {
    localStorage.setItem('smashflow_user', JSON.stringify(user))
    localStorage.setItem('smashflow_token', token)
    set({ user, token })
  },
  logout: () => {
    localStorage.removeItem('smashflow_user')
    localStorage.removeItem('smashflow_token')
    set({ user: null, token: null })
    // Xóa toàn bộ dữ liệu đã tải (máy dùng chung không được thấy dữ liệu của người trước)
    queryClient.clear()
  },
}))

/**
 * Kiểm tra nhẹ hạn token: mỗi phút và mỗi khi quay lại app (focus / hiện tab).
 * Token hết hạn → đăng xuất (xóa cache), các route cần đăng nhập tự chuyển về /login?redirect=…
 * Token bị server thu hồi sớm (đổi mật khẩu, bị xóa…) thì do interceptor 401 trong lib/api.ts xử lý.
 * @returns hàm dừng theo dõi
 */
export function startTokenExpiryWatcher(intervalMs = 60 * 1000): () => void {
  const check = () => {
    const { token, logout } = useAuthStore.getState()
    if (token && !isTokenValid(token)) logout()
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') check()
  }
  const timer = window.setInterval(check, intervalMs)
  window.addEventListener('focus', check)
  document.addEventListener('visibilitychange', onVisibility)
  check()
  return () => {
    window.clearInterval(timer)
    window.removeEventListener('focus', check)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
