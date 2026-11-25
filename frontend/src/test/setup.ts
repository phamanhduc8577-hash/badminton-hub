import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { vi } from 'vitest'

window.alert = vi.fn()

// Mock IntersectionObserver for JSDOM
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin: string = ''
  readonly scrollMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []
  disconnect = vi.fn()
  observe = vi.fn()
  takeRecords = vi.fn(() => [])
  unobserve = vi.fn()
}
window.IntersectionObserver = MockIntersectionObserver as any

// Mock ResizeObserver for JSDOM
class MockResizeObserver implements ResizeObserver {
  disconnect = vi.fn()
  observe = vi.fn()
  unobserve = vi.fn()
}
window.ResizeObserver = MockResizeObserver as any

// Chạy song song cả bộ test thì lần render đầu các màn hình lớn có thể > 1s → nới thời gian chờ findBy*/waitFor
configure({ asyncUtilTimeout: 4000 })
