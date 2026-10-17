import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HostOverviewView } from '../views/HostOverviewView'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const emptyMonth = {
  year: 2026, month: 10, totalRevenue: 0, totalExpenses: 0, netProfit: 0, totalDepositCollected: 0,
  costCourt: 0, costShuttlecock: 0, costDrinks: 0, totalSessions: 0, totalPlayerTurnout: 0, checkedInPlayers: 0,
  attendanceRate: 0, fixedMemberTurnout: 0, guestTurnout: 0, maleTurnout: 0, femaleTurnout: 0,
  vietQrPayments: 0, cashPayments: 0, unpaidCount: 0, sessionSummaries: [], topPlayers: [],
}

const rows = [
  {
    participantId: 11, sessionId: 5, sessionTitle: 'Ca tối thứ 3', sessionStartTime: '2026-09-01T18:00:00',
    name: 'Khách Cũ', phone: '0911222333', finalFee: 60000, depositAmount: 20000, depositStatus: 'PAID', paymentMethod: 'CASH',
  },
  {
    participantId: 12, sessionId: 6, sessionTitle: 'Ca tối thứ 5', sessionStartTime: '2026-09-03T18:00:00',
    name: 'Khách Hai', phone: '0911000444', finalFee: 50000, depositAmount: 20000, depositStatus: 'PAID', paymentMethod: 'VIETQR',
  },
]

const mockGets = (reconciliation: unknown[]) => {
  ;(api.get as any).mockImplementation((url: string) => {
    if (url === '/reports/monthly') return Promise.resolve({ data: emptyMonth })
    if (url === '/reports/reconciliation') return Promise.resolve({ data: reconciliation })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
}

const renderView = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HostOverviewView />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('HostOverviewView - Đối soát cọc trước đây', () => {
  beforeEach(() => vi.clearAllMocks())

  it('có dữ liệu: hiện thẻ thu gọn, bấm mở thì thấy giải thích và từng lượt', async () => {
    mockGets(rows)
    renderView()
    const toggle = await screen.findByRole('button', { name: /Đối soát cọc trước đây/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/2 lượt/)).toBeInTheDocument()
    expect(screen.queryByText('Khách Cũ')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/trước bản sửa lỗi tính cọc/i)).toBeInTheDocument()
    expect(screen.getByText('Khách Cũ')).toBeInTheDocument()
    expect(screen.getByText('Khách Hai')).toBeInTheDocument()
    expect(screen.getByText('0911222333')).toBeInTheDocument()
    expect(screen.getByText(/Ca tối thứ 3/)).toBeInTheDocument()
  })

  it('không có dữ liệu: ẩn hẳn thẻ đối soát', async () => {
    mockGets([])
    renderView()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/reports/reconciliation'))
    await screen.findByText(/Không có ca đánh nào trong tháng/)
    expect(screen.queryByText(/Đối soát cọc trước đây/i)).not.toBeInTheDocument()
  })
})
