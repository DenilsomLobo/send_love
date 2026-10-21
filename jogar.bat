@echo off
setlocal
title Send Love
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js para iniciar o Send Love.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  call npm.cmd install --cache .npm-cache
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node scripts\jogar.mjs %*
if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar o Send Love. Confira a mensagem acima.
  pause
  exit /b 1
)
