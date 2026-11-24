# Script kiểm tra SePay Webhook Endpoint cục bộ hoặc production
param(
    [string]$BaseUrl = "http://localhost:8081",
    [string]$ApiKey = "my_secret_sepay_api_key_123"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " KIỂM TRA TÍCH HỢP SEPAY WEBHOOK" -ForegroundColor Cyan
Write-Host " URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Test 401 Unauthorized khi không có header Authorization
Write-Host "`n[Test 1] Gửi webhook KHÔNG CÓ API KEY (Kỳ vọng: 401 Unauthorized)..." -ForegroundColor Yellow
try {
    $res = Invoke-WebRequest -Uri "$BaseUrl/api/sepay/webhook" -Method POST -ContentType "application/json" -Body '{"id": 1, "transferAmount": 10000}' -SkipHttpErrorCheck
    if ($res.StatusCode -eq 401) {
        Write-Host "✅ PASSED: Trả về HTTP 401 Unauthorized như mong đợi." -ForegroundColor Green
    } else {
        Write-Host "❌ FAILED: Trả về HTTP $($res.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "Lỗi kết nối: $_" -ForegroundColor Red
}

# 2. Test 200 OK khi gửi webhook mẫu qua alias /webhook/bank
Write-Host "`n[Test 2] Gửi webhook có API KEY hợp lệ (Kỳ vọng: 200 OK)..." -ForegroundColor Yellow
$body = @{
    id = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    gateway = "MBBank"
    transactionDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    accountNumber = "0325872682"
    transferType = "in"
    transferAmount = 50000
    content = "SF101 thanh toan tien san"
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "$BaseUrl/api/sepay/webhook" -Method POST -Headers @{ "Authorization" = "Apikey $ApiKey" } -ContentType "application/json" -Body $body
    Write-Host "✅ PASSED: Response: $($res | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "Lỗi: $_" -ForegroundColor Red
}

# 3. Test lấy cấu hình ngân hàng công khai
Write-Host "`n[Test 3] Kiểm tra cấu hình công khai GET /api/sepay/config..." -ForegroundColor Yellow
try {
    $cfg = Invoke-RestMethod -Uri "$BaseUrl/api/sepay/config" -Method GET
    Write-Host "✅ PASSED: Bank: $($cfg.bank.bankId) - STK: $($cfg.bank.accountNo) - Webhook Enabled: $($cfg.webhookEnabled)" -ForegroundColor Green
} catch {
    Write-Host "Lỗi: $_" -ForegroundColor Red
}
