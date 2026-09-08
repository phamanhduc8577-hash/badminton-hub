import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/ToastProvider'
import { SessionListView } from './views/SessionListView'
import { SessionDetailView } from './views/SessionDetailView'
import { HostDashboardView } from './views/HostDashboardView'
import { CreateSessionView } from './views/CreateSessionView'
import { LeaderboardView } from './views/LeaderboardView'
import { LoyaltyView } from './views/LoyaltyView'
import { MemberListView } from './views/MemberListView'
import { LoginView } from './views/LoginView'
import { useAuthStore } from './store/useAuthStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  const { user } = useAuthStore()

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<SessionListView />} />
              <Route path="sessions/:id" element={<SessionDetailView />} />
              <Route path="leaderboard" element={<LeaderboardView />} />
              <Route path="members" element={<MemberListView />} />
              <Route path="loyalty" element={<LoyaltyView />} />
              <Route path="login" element={<LoginView />} />
              <Route path="profile" element={<LoyaltyView />} />

              {/* Host Protected Routes */}
              <Route
                path="host"
                element={
                  user?.role === 'HOST' ? (
                    <SessionListView />
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="host/session/:id"
                element={
                  user?.role === 'HOST' ? (
                    <HostDashboardView />
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="host/create-session"
                element={
                  user?.role === 'HOST' ? (
                    <CreateSessionView />
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App

