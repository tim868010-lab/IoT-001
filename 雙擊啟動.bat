@echo off
chcp 65001 >nul
echo ===================================================
echo   智慧能源監控系統 - 快速啟動腳本
echo ===================================================
echo.

:: 1. 檢查 Python 是否安裝
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [錯誤] 偵測不到 Python！請確認您的電腦已安裝 Python 並將其加入系統變數 (PATH)。
    echo 您可以從 https://www.python.org/ 下載最新版的 Python 安裝。
    echo 安裝時請務必勾選 "Add Python to PATH" 選項。
    echo.
    pause
    exit /b
)

:: 2. 安裝必要套件
echo [1/3] 正在檢查與安裝必要套件 (Flask, requests)...
python -m pip install --upgrade pip >nul 2>&1
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [警告] 依賴安裝失敗，嘗試直接安裝 Flask 與 requests...
    pip install Flask requests
)

:: 3. 啟動 Flask 後端
echo [2/3] 正在獨立視窗啟動 Flask 後端伺服器...
start "智慧能源監控 - Web 伺服器" cmd /k python app.py

:: 延遲 3 秒讓伺服器啟動，然後打開瀏覽器
echo [3/3] 正在開啟瀏覽器網頁...
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:5000

:: 4. 啟動模擬器
echo.
echo ===================================================
echo   正在啟動 IoT 能源數據模擬器 (本視窗)...
echo   (模擬器會持續發送模擬資料到網頁儀表板上)
echo   欲關閉系統，請關閉這兩個命令列視窗即可。
echo ===================================================
echo.
python simulator.py

pause
