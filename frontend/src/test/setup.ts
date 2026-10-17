import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { vi } from 'vitest'

window.alert = vi.fn()

// Chạy song song cả bộ test thì lần render đầu các màn hình lớn có thể > 1s → nới thời gian chờ findBy*/waitFor
configure({ asyncUtilTimeout: 4000 })
