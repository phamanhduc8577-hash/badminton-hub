import { create } from 'zustand'
import { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('smashflow_user') || 'null'),
  token: localStorage.getItem('smashflow_token'),
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
