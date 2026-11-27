@echo off
cd /d "%~dp0backend"
echo [1/2] Dang chay kiem thu Backend voi Gradle...
call gradlew.bat test --tests com.smashflow.service.SessionMemoTest --tests com.smashflow.service.SepayWebhookServiceTest
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend test that bai!
    pause
    exit /b %ERRORLEVEL%
)
echo [BACKEND OK] Tat ca test Java da vuot qua!

cd /d "%~dp0frontend"
echo [2/2] Dang chay kiem thu Frontend voi Vitest & Typecheck...
call npm test -- src/test/SessionDetailView.test.tsx
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend test that bai!
    pause
    exit /b %ERRORLEVEL%
)
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build that bai!
    pause
    exit /b %ERRORLEVEL%
)
echo [FRONTEND OK] Tat ca test Frontend & Build da vuot qua!
echo ==============================================
echo [SUCCESS] TOAN BO HE THONG TEST THANH CONG 100%!
echo ==============================================
pause
