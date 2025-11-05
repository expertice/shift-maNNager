# First-time startup script for shift-Manager project (runs migrations and seed)

param(
    [switch]$SkipDependencies
)

$ErrorActionPreference = "Stop"

# Save project root directory
$ProjectRoot = (Get-Location).Path

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  First start: shift-Manager Project" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check for required tools
Write-Host "[1/7] Checking required tools..." -ForegroundColor Yellow

# Check Docker
$dockerCheck = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCheck) {
    $dockerVersion = docker --version 2>&1
    Write-Host "  [+] Docker found: $dockerVersion" -ForegroundColor Green
} else {
    Write-Host "  [x] Docker not found. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check Node.js
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCheck) {
    $nodeVersion = node --version 2>&1
    Write-Host "  [+] Node.js found: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  [x] Node.js not found. Please install Node.js >= 18.0.0." -ForegroundColor Red
    exit 1
}

# Check npm
$npmCheck = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCheck) {
    $npmVersion = npm --version 2>&1
    Write-Host "  [+] npm found: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "  [x] npm not found." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 1: Start database
Write-Host "[2/7] Starting PostgreSQL database..." -ForegroundColor Yellow

# Check if container is already running
$containerOutput = docker ps -q -f name=shift-manager-db 2>&1
$containerRunning = $containerOutput -and $containerOutput -ne ""
if ($containerRunning) {
    Write-Host "  [+] Database container already running" -ForegroundColor Green
} else {
    Write-Host "  -> Starting Docker container..." -ForegroundColor Cyan
    $ErrorActionPreference = "Continue"
    $dockerOutput = docker-compose up -d 2>&1 | Out-String
    $ErrorActionPreference = "Stop"
    # Check if container actually started (warnings are OK)
    $containerCheck = docker ps -q -f name=shift-manager-db 2>&1
    if (-not $containerCheck -or $containerCheck -eq "") {
        Write-Host "  [x] Failed to start Docker container" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  -> Waiting for database to be ready..." -ForegroundColor Cyan
    $maxAttempts = 30
    $attempt = 0
    $dbReady = $false
    
    while ($attempt -lt $maxAttempts -and -not $dbReady) {
        Start-Sleep -Seconds 2
        $healthOutput = docker inspect --format='{{.State.Health.Status}}' shift-manager-db 2>&1
        $health = $healthOutput | Out-String
        if ($health -match "healthy" -or $health -eq "") {
            $null = docker exec shift-manager-db pg_isready -U shift_manager 2>&1
            if ($LASTEXITCODE -eq 0) {
                $dbReady = $true
            }
        }
        $attempt++
        Write-Host "    Attempt $attempt/$maxAttempts..." -ForegroundColor Gray
    }
    
    if ($dbReady) {
        Write-Host "  [+] Database is ready" -ForegroundColor Green
    } else {
        Write-Host "  [!] Database started but readiness check took too long. Continuing..." -ForegroundColor Yellow
    }
}

Write-Host ""

# Step 2: Setup backend
Write-Host "[3/7] Setting up backend..." -ForegroundColor Yellow

Push-Location server

# Install dependencies
if (-not $SkipDependencies) {
    if (-not (Test-Path "node_modules")) {
        Write-Host "  -> Installing backend dependencies..." -ForegroundColor Cyan
        $ErrorActionPreference = "Continue"
        $npmOutput = npm install 2>&1 | Out-String
        $ErrorActionPreference = "Stop"
        Write-Host "  [+] Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "  [+] Backend dependencies already installed" -ForegroundColor Green
    }
} else {
    Write-Host "  [o] Skipped dependency installation" -ForegroundColor Gray
}

# Create .env file
if (-not (Test-Path ".env")) {
    Write-Host "  -> Creating .env file..." -ForegroundColor Cyan
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "  [+] .env file created from .env.example" -ForegroundColor Green
    }
}

# Generate Prisma client
$prismaClientPath = "node_modules\.prisma\client\index.d.ts"
if (Test-Path $prismaClientPath) {
    Write-Host "  [+] Prisma client already generated" -ForegroundColor Green
} else {
    Write-Host "  -> Generating Prisma client..." -ForegroundColor Cyan
    $null = & npx prisma generate 2>&1
    Write-Host "  [+] Prisma client generated" -ForegroundColor Green
}

# Apply migrations and seed
Write-Host "  -> Applying database migrations..." -ForegroundColor Cyan
$null = & npx prisma migrate deploy 2>&1
Write-Host "  [+] Migrations applied" -ForegroundColor Green

Write-Host "  -> Seeding database (skips if data exists)..." -ForegroundColor Cyan
$env:SEED_RESET = "false"
$null = & npx prisma db seed 2>&1
Write-Host "  [+] Seed step finished" -ForegroundColor Green

Pop-Location

Write-Host ""

# Step 3: Setup frontend
Write-Host "[4/7] Setting up frontend..." -ForegroundColor Yellow
if (-not $SkipDependencies) {
    if (-not (Test-Path "node_modules")) {
        Write-Host "  -> Installing frontend dependencies..." -ForegroundColor Cyan
        $ErrorActionPreference = "Continue"
        $npmOutput = npm install 2>&1 | Out-String
        $ErrorActionPreference = "Stop"
        Write-Host "  [+] Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "  [+] Frontend dependencies already installed" -ForegroundColor Green
    }
} else {
    Write-Host "  [o] Skipped dependency installation" -ForegroundColor Gray
}

Write-Host ""

# Step 4: Start backend
Write-Host "[5/7] Starting backend server..." -ForegroundColor Yellow
$backendPort = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($backendPort) {
    Write-Host "  [!] Port 3000 is already in use. Backend may already be running." -ForegroundColor Yellow
    Write-Host "  -> Skipping backend startup" -ForegroundColor Cyan
} else {
    Write-Host "  -> Starting backend server in new PowerShell window..." -ForegroundColor Cyan
    $serverPath = Join-Path $ProjectRoot "server"
    $backendScript = "cd '$serverPath'`r`n`$env:NODE_ENV='development'`r`nnpm run dev"
    $backendScript | Out-File -FilePath "$env:TEMP\shift-manager-backend.ps1" -Encoding UTF8
    Start-Process powershell -ArgumentList "-NoExit", "-File", "$env:TEMP\shift-manager-backend.ps1" -WindowStyle Normal
    Start-Sleep -Seconds 3
    Write-Host "  [+] Backend server started (http://localhost:3000)" -ForegroundColor Green
}

Write-Host ""

# Step 5: Start frontend
Write-Host "[6/7] Starting frontend application..." -ForegroundColor Yellow
$frontendPort = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($frontendPort) {
    Write-Host "  [!] Port 5173 is already in use. Frontend may already be running." -ForegroundColor Yellow
    Write-Host "  -> Skipping frontend startup" -ForegroundColor Cyan
} else {
    Write-Host "  -> Starting frontend server in new PowerShell window..." -ForegroundColor Cyan
    $frontendScript = "cd '$ProjectRoot'`r`n`$env:NODE_ENV='development'`r`nnpm run dev"
    $frontendScript | Out-File -FilePath "$env:TEMP\shift-manager-frontend.ps1" -Encoding UTF8
    Start-Process powershell -ArgumentList "-NoExit", "-File", "$env:TEMP\shift-manager-frontend.ps1" -WindowStyle Normal
    Start-Sleep -Seconds 2
    Write-Host "  [+] Frontend server started (http://localhost:5173)" -ForegroundColor Green
}

Write-Host ""

# Step 6: Final check
Write-Host "[7/7] Final check..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "  [+] Backend is responding" -ForegroundColor Green
    }
} catch {
    Write-Host "  [!] Backend is not ready yet (may need to wait a few more seconds)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  First start completed!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Available services:" -ForegroundColor White
Write-Host "  * Frontend:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "  * Backend:   http://localhost:3000" -ForegroundColor Cyan
Write-Host "  * Health:    http://localhost:3000/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: next runs should use .\\start.ps1 (no migrations/seeding)." -ForegroundColor Yellow
Write-Host ""


