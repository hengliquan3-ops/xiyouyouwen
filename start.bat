@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 --version >nul 2>nul
  if %errorlevel%==0 (
    py -3 server.py
    pause
    exit /b 0
  )
)
where python >nul 2>nul
if %errorlevel%==0 (
  python --version >nul 2>nul
  if %errorlevel%==0 (
    python server.py
    pause
    exit /b 0
  )
)
echo 没有找到 Python 3。请先安装 Python 3，再双击本文件。
pause
exit /b 1