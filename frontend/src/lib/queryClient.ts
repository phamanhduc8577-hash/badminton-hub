import { QueryClient } from '@tanstack/react-query'

/**
 * QueryClient dùng chung cho cả app. Tách module riêng để code ngoài React
 * (store đăng nhập, interceptor axios) có thể xóa cache khi đăng xuất / hết phiên —
 * tránh máy dùng chung vẫn thấy dữ liệu của người trước (vd. dữ liệu Host).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true, // Quay lại app (vd. sau khi chuyển khoản cọc) thì tải lại dữ liệu cũ
      staleTime: 60 * 1000, // Cache dữ liệu 1 phút, giảm tải gọi API liên tục
    },
  },
})
