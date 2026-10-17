import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/ToastProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PageLoader } from './components/PageLoader'
import { SessionListView } from './views/SessionListView'
import { SessionDetailView } from './views/SessionDetailView'
import { LoginView } from './views/LoginView'
import { useAuthStore, startTokenExpiryWatcher } from './store/useAuthStore'
import { queryClient } from './lib/queryClient'

// Tách file: trang Host và các trang nặng chỉ tải khi mở tới (giảm file JS chính cho 4G)
const HostDashboardView = lazy(() => import('./views/HostDashboardView').then((m) => ({ default: m.HostDashboardView })))
const HostOverviewView = lazy(() => import('./views/HostOverviewView').then((m) => ({ default: m.HostOverviewView })))
const CreateSessionView = lazy(() => import('./views/CreateSessionView').then((m) => ({ default: m.CreateSessionView })))
const MemberListView = lazy(() => import('./views/MemberListView').then((m) => ({ default: m.MemberListView })))
const LeaderboardView = lazy(() => import('./views/LeaderboardView').then((m) => ({ default: m.LeaderboardView })))
const LoyaltyView = lazy(() => import('./views/LoyaltyView').then((m) => ({ default: m.LoyaltyView })))

const withSuspense = (node: React.ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>

/** Chỉ Host vào được; chưa đăng nhập → /login?redirect=<trang đang mở>; đã đăng nhập nhưng không phải Host → trang chủ */
export const RequireHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthStore()
  const location = useLocation()
  if (user?.role === 'HOST') return <>{withSuspense(children)}</>
  if (user) return <Navigate to="/" replace />
  return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
}

function App() {
  // Token hết hạn khi đang mở app → tự đăng xuất (kiểm tra mỗi phút và khi quay lại app)
  useEffect(() => startTokenExpiryWatcher(), [])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<SessionListView />} />
                <Route path="sessions/:id" element={<SessionDetailView />} />
                <Route path="leaderboard" element={withSuspense(<LeaderboardView />)} />
                <Route path="members" element={withSuspense(<MemberListView />)} />
                <Route path="loyalty" element={withSuspense(<LoyaltyView />)} />
                <Route path="login" element={<LoginView />} />
                <Route path="profile" element={withSuspense(<LoyaltyView />)} />

                {/* Host Protected Routes */}
                <Route path="host" element={<RequireHost><HostOverviewView /></RequireHost>} />
                <Route path="host/session/:id" element={<RequireHost><HostDashboardView /></RequireHost>} />
                <Route path="host/create-session" element={<RequireHost><CreateSessionView /></RequireHost>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
