import { create } from 'zustand'
import { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

/**
 * Check if a JWT token is expired before initializing state
 */
function isTokenValid(token: string | null): boolean {
  if (!token) return false
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(atob(parts[1]))
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
  },
}))

