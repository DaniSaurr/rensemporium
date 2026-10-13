@echo off
rem Double-click to rebuild ren's emporium (drafts included) and open it in Firefox.
rem Close the minimised server window to stop it.
cd /d "%~dp0"
python tools\build.py --drafts
start "ren's emporium server" /min python -m http.server 8790 --directory _site
timeout /t 2 /nobreak >nul
start "" "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" http://localhost:8790/
echo.
echo ren's emporium is at http://localhost:8790/  (the server runs in the minimised window)
pause
