@echo off
title MicroDB Studio - SD & Embedded Database Suite
echo ========================================================
echo   MICRODB STUDIO - INICIANDO SOFTWARE DE ESCRITORIO
echo ========================================================
echo.

cd /d "%~dp0"
call npm run dev
pause
