@echo off
SET PATH=C:\Program Files\nodejs;%PATH%
echo Node version:
node --version
echo NPM version:
npm --version
echo.
echo Installing dependencies...
cd /d "%~dp0"
npm install
echo.
echo Running Prisma setup...
npx prisma generate
npx prisma db push
echo.
echo Seeding database...
node prisma/seed.js
echo.
echo Setup complete! Starting server...
node server.js
