@echo off
REM Rig Setup launcher for Windows (cmd.exe).
setlocal
set "SCRIPT_DIR=%~dp0"

where python >nul 2>&1
if %errorlevel%==0 (
  python "%SCRIPT_DIR%app.py" %*
  goto :eof
)

where py >nul 2>&1
if %errorlevel%==0 (
  py "%SCRIPT_DIR%app.py" %*
  goto :eof
)

echo Python 3 was not found on this machine.
echo Install it, then re-run start.bat :
echo   winget install --id Python.Python.3.12 -e
echo   (or download from https://www.python.org/downloads/)
exit /b 1
