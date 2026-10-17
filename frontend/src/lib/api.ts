import axios from 'axios'
import { useAuthStore } from '../store/useAuthStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smashflow_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * URL trang đăng nhập kèm `redirect` về trang hiện tại.
 * Trả về null khi đang ở /login (tránh vòng lặp chuyển hướng).
 */
export function buildLoginRedirectUrl(pathname: string, search = ''): string | null {
  if (pathname === '/login' || pathname.startsWith('/login/')) return null
  return `/login?redirect=${encodeURIComponent(`${pathname}${search}`)}`
}

let redirectingToLogin = false

/** Cho test: đặt lại cờ chống chuyển hướng lặp */
export const resetLoginRedirectGuard = () => {
  redirectingToLogin = false
}

const hasAuthHeader = (config: any): boolean => {
  const headers = config?.headers
  if (!headers) return false
  const value = typeof headers.get === 'function' ? headers.get('Authorization') : headers.Authorization
  return !!value
}

/**
 * Xử lý lỗi 401 của request CÓ gửi token (token hết hạn / bị thu hồi):
 * đăng xuất (xóa cache) rồi chuyển về /login?redirect=<trang hiện tại>.
 * Request không kèm token (vd. đăng nhập sai mật khẩu) thì để màn hình tự báo lỗi.
 */
export function handleUnauthorized(
  error: any,
  redirect: (url: string) => void = (url) => window.location.replace(url)
): void {
  if (error?.response?.status !== 401 || !hasAuthHeader(error.config)) return
  // Sync zustand store state immediately so UI updates right away
  useAuthStore.getState().logout()
  if (redirectingToLogin) return
  const url = buildLoginRedirectUrl(window.location.pathname, window.location.search)
  if (!url) return
  redirectingToLogin = true
  redirect(url)
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    handleUnauthorized(error)
    return Promise.reject(error)
  }
)
