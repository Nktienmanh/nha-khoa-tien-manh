@echo off
chcp 65001 >nul
title Nha Khoa Tien Manh - May chu
cd /d "%~dp0"
where node >nul 2>nul || (echo Chua cai Node.js. Tai tai https://nodejs.org roi chay lai. & pause & exit /b)
start "" http://localhost:3000
node server.js
pause
