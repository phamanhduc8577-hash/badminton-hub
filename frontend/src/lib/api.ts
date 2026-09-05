import axios from 'axios'

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('smashflow_token')
      localStorage.removeItem('smashflow_user')
    }
    return Promise.reject(error)
  }
)
