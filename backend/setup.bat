@echo off
echo ============================================
echo  Sakura AI Backend Setup
echo ============================================
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org
    echo Choose the LTS version (18.x or higher)
    pause
    exit /b 1
)

echo [OK] Node.js found:
node --version

echo.
echo [1/4] Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)

echo.
echo [2/4] Generating Prisma client...
npx prisma generate
if %errorlevel% neq 0 (
    echo [ERROR] Prisma generate failed
    pause
    exit /b 1
)

echo.
echo [3/4] Creating database...
npx prisma db push
if %errorlevel% neq 0 (
    echo [ERROR] Database creation failed
    pause
    exit /b 1
)

echo.
echo [4/4] Seeding database with templates...
node prisma/seed.js
if %errorlevel% neq 0 (
    echo [WARNING] Seed failed - you can run it manually later
)

echo.
echo ============================================
echo  Setup Complete!
echo ============================================
echo.
echo NEXT STEPS:
echo 1. Copy .env.example to .env
echo 2. Fill in your API keys in .env
echo 3. Run: npm run dev
echo.
echo The backend will start on http://localhost:3001
echo.
pause
