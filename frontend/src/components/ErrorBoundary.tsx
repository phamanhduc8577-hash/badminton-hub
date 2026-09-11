import React, { Component, ErrorInfo, ReactNode } from 'react'
import { DuckMascot } from './DuckMascot'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Smashflow Uncaught React Error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
          <DuckMascot size={64} rounded="2xl" className="shadow-lg border border-slate-200" />
          <h2 className="text-xl font-black text-slate-900">Đã xảy ra sự cố khi tải trang</h2>
          <p className="text-xs text-slate-500 max-w-md">
            {this.state.error?.message || 'Có lỗi ngoài ý muốn trong quá trình kết nối. Vui lòng bấm nút bên dưới để thử lại.'}
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow transition active:scale-95"
            >
              Tải lại trang (F5)
            </button>
            <button
              onClick={() => {
                window.location.href = '/'
              }}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition"
            >
              Về trang chủ
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
