import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAuthStore, startTokenExpiryWatcher } from '../store/useAuthStore'
import { queryClient } from '../lib/queryClient'
import { buildLoginRedirectUrl, handleUnauthorized, resetLoginRedirectGuard } from '../lib/api'

const user = { id: 1, fullName: 'Host', phone: '1', role: 'HOST', gender: 'MALE' } as any

/** JWT giả (chỉ phần payload có ý nghĩa) */
const fakeJwt = (expSeconds: number) =>
  `h.${btoa(JSON.stringify({ sub: '1', exp: expSeconds })).replace(/=+$/, '')}.s`

const unauthorized = (withAuthHeader: boolean) => ({
  response: { status: 401, data: {} },
  config: { headers: withAuthHeader ? { Authorization: 'Bearer abc' } : {} },
})

describe('đăng xuất xóa dữ liệu tạm', () => {
  beforeEach(() => {
    queryClient.clear()
    useAuthStore.getState().setAuth(user, 'tok')
  })

  it('logout() xóa toàn bộ cache react-query', () => {
    queryClient.setQueryData(['members'], [{ id: 1 }])
    queryClient.setQueryData(['session', '5'], { id: 5 })
    useAuthStore.getState().logout()
    expect(queryClient.getQueryData(['members'])).toBeUndefined()
    expect(queryClient.getQueryData(['session', '5'])).toBeUndefined()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(useAuthStore.getState().user).toBeNull()
    expect(localStorage.getItem('smashflow_token')).toBeNull()
  })

  it('token hết hạn được phát hiện khi quay lại app → tự đăng xuất', () => {
    useAuthStore.getState().setAuth(user, fakeJwt(Math.floor(Date.now() / 1000) - 60))
    queryClient.setQueryData(['members'], [1])
    const stop = startTokenExpiryWatcher(60_000)
    expect(useAuthStore.getState().token).toBeNull()
    expect(queryClient.getQueryData(['members'])).toBeUndefined()
    stop()
  })

  it('token còn hạn thì giữ nguyên', () => {
    const token = fakeJwt(Math.floor(Date.now() / 1000) + 3600)
    useAuthStore.getState().setAuth(user, token)
    const stop = startTokenExpiryWatcher(60_000)
    window.dispatchEvent(new Event('focus'))
    expect(useAuthStore.getState().token).toBe(token)
    stop()
  })
})

describe('interceptor 401', () => {
  beforeEach(() => {
    resetLoginRedirectGuard()
    queryClient.clear()
    useAuthStore.getState().setAuth(user, 'tok')
  })

  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('buildLoginRedirectUrl giữ đường dẫn + query, không lặp khi đang ở /login', () => {
    expect(buildLoginRedirectUrl('/host/session/5', '?tab=1')).toBe('/login?redirect=%2Fhost%2Fsession%2F5%3Ftab%3D1')
    expect(buildLoginRedirectUrl('/login', '?redirect=%2Fhost')).toBeNull()
  })

  it('401 của request có token: đăng xuất, xóa cache, chuyển về /login?redirect=<trang hiện tại>', () => {
    window.history.replaceState({}, '', '/sessions/5?token=ABC')
    queryClient.setQueryData(['session', '5'], { id: 5 })
    const redirect = vi.fn()
    handleUnauthorized(unauthorized(true), redirect)
    expect(useAuthStore.getState().user).toBeNull()
    expect(queryClient.getQueryData(['session', '5'])).toBeUndefined()
    expect(redirect).toHaveBeenCalledWith('/login?redirect=%2Fsessions%2F5%3Ftoken%3DABC')
  })

  it('nhiều request cùng 401 chỉ chuyển hướng 1 lần', () => {
    window.history.replaceState({}, '', '/host')
    const redirect = vi.fn()
    handleUnauthorized(unauthorized(true), redirect)
    handleUnauthorized(unauthorized(true), redirect)
    expect(redirect).toHaveBeenCalledTimes(1)
  })

  it('đang ở /login thì không chuyển hướng (tránh vòng lặp)', () => {
    window.history.replaceState({}, '', '/login?redirect=%2Fhost')
    const redirect = vi.fn()
    handleUnauthorized(unauthorized(true), redirect)
    expect(redirect).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('401 của request KHÔNG kèm token (vd. sai mật khẩu) thì không đăng xuất / chuyển hướng', () => {
    window.history.replaceState({}, '', '/sessions/5')
    const redirect = vi.fn()
    handleUnauthorized(unauthorized(false), redirect)
    expect(redirect).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).not.toBeNull()
  })

  it('lỗi khác 401 bỏ qua', () => {
    const redirect = vi.fn()
    handleUnauthorized({ response: { status: 403 }, config: { headers: { Authorization: 'Bearer x' } } }, redirect)
    expect(redirect).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).not.toBeNull()
  })
})
