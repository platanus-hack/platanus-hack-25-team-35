@echo off
echo [Setup] Checking environment...

WHERE docker >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo [Error] Docker is not installed or not in PATH.
    echo Please install Docker Desktop: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

WHERE npm >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo [Warning] Node.js/npm is not installed. Local development requires Node.js.
    echo You can still run the app via Docker.
)

echo [Setup] Building Docker container...
docker-compose up --build
