# Full startup script for shift-Manager project
# Automates startup of all components: DB, backend, frontend

param(
    [switch]$SkipDependencies,
    [switch]$SkipMigrations
)

$ErrorActionPreference = "Stop"

# Save project root directory
# Use $PSScriptRoot to get the directory where the script is located
# This is more reliable than Get-Location when script is executed from different directories
$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
    # Fallback for PS v2 compatibility
    $ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if (-not $ProjectRoot) {
    # Last resort fallback
    $ProjectRoot = (Get-Location).Path
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Starting shift-Manager Project" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project root: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

# Function to check command execution success
function Test-Command {
    param([string]$Command)
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
        Write-Host "Error executing: $Command" -ForegroundColor Red
        exit 1
    }
}

# Function to run npx commands with better error handling
function Invoke-NpxCommand {
    param(
        [string]$Command,
        [string]$SuccessMessage,
        [string]$WarningMessage,
        [switch]$ContinueOnError
    )
    
    # Split command into parts for proper argument passing
    $commandParts = $Command -split '\s+'
    $result = & npx $commandParts 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($null -eq $exitCode -or $exitCode -eq 0) {
        if ($SuccessMessage) {
            Write-Host "  $SuccessMessage" -ForegroundColor Green
        }
        return $true
    } else {
        if ($ContinueOnError) {
            if ($WarningMessage) {
                Write-Host "  $WarningMessage" -ForegroundColor Yellow
            }
            return $false
        } else {
            Write-Host "  [x] Error executing: npx $Command" -ForegroundColor Red
            Write-Host "      $result" -ForegroundColor Gray
            return $false
        }
    }
}

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

# Ensure we're in the correct directory
Set-Location $ProjectRoot
Push-Location server

# Install dependencies
if (-not $SkipDependencies) {
    if (-not (Test-Path "node_modules")) {
        Write-Host "  -> Installing backend dependencies..." -ForegroundColor Cyan
        
        # Try regular install first
        $ErrorActionPreference = "Continue"
        $npmOutput = npm install 2>&1 | Out-String
        $npmError = $npmOutput -match "error|ERESOLVE|EINVALID"
        
        if ($npmError) {
            # Try with --legacy-peer-deps flag for dependency conflicts
            Write-Host "  -> Dependency conflicts detected, retrying with --legacy-peer-deps..." -ForegroundColor Yellow
            $ErrorActionPreference = "Continue"
            $npmOutput = npm install --legacy-peer-deps 2>&1 | Out-String
            $npmError = $npmOutput -match "error|ERESOLVE|EINVALID"
            
            if ($npmError) {
                Write-Host "  [x] Error installing dependencies" -ForegroundColor Red
                Write-Host "      Try running 'npm install --legacy-peer-deps' manually in server folder" -ForegroundColor Yellow
                Write-Host "      Or use 'npm install --force' to override conflicts" -ForegroundColor Yellow
                Pop-Location
                exit 1
            }
        }
        
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
    } else {
        $envLines = @(
            'DATABASE_URL="postgresql://shift_manager:shift_manager_pass@localhost:5433/shift_manager?schema=public"',
            'JWT_SECRET="your-secret-key-change-in-production"',
            'JWT_EXPIRES_IN="7d"',
            'PORT=3000',
            'NODE_ENV=development',
            'WS_PORT=3000'
        )
        $envLines | Out-File -FilePath ".env" -Encoding UTF8
        Write-Host "  [+] .env file created with default settings" -ForegroundColor Green
    }
} else {
    Write-Host "  [+] .env file already exists" -ForegroundColor Green
}

# Generate Prisma client
$prismaClientPath = "node_modules\.prisma\client\index.d.ts"
if (Test-Path $prismaClientPath) {
    Write-Host "  [+] Prisma client already generated" -ForegroundColor Green
} else {
    Write-Host "  -> Generating Prisma client..." -ForegroundColor Cyan
    $null = & npx prisma generate 2>&1
    if ($null -eq $LASTEXITCODE -or $LASTEXITCODE -eq 0) {
        Write-Host "  [+] Prisma client generated" -ForegroundColor Green
    } else {
        Write-Host "  [!] Warning: Prisma generate may have failed (file may be locked)" -ForegroundColor Yellow
        Write-Host "      Continuing anyway - client may already exist" -ForegroundColor Gray
    }
}

Write-Host "  [o] Migrations not executed in normal start. Use first_start.ps1 for initial setup." -ForegroundColor Gray

Pop-Location

Write-Host ""

# Step 3: Setup frontend
Write-Host "[4/7] Setting up frontend..." -ForegroundColor Yellow

# Ensure we're back in project root
Set-Location $ProjectRoot

# Install dependencies
if (-not $SkipDependencies) {
    if (-not (Test-Path "node_modules")) {
        Write-Host "  -> Installing frontend dependencies..." -ForegroundColor Cyan
        
        # Try regular install first
        $ErrorActionPreference = "Continue"
        $npmOutput = npm install 2>&1 | Out-String
        $npmError = $npmOutput -match "error|ERESOLVE|EINVALID"
        
        if ($npmError) {
            # Try with --legacy-peer-deps flag for dependency conflicts
            Write-Host "  -> Dependency conflicts detected, retrying with --legacy-peer-deps..." -ForegroundColor Yellow
            $ErrorActionPreference = "Continue"
            $npmOutput = npm install --legacy-peer-deps 2>&1 | Out-String
            $npmError = $npmOutput -match "error|ERESOLVE|EINVALID"
            
            if ($npmError) {
                Write-Host "  [x] Error installing dependencies" -ForegroundColor Red
                Write-Host "      Try running 'npm install --legacy-peer-deps' manually" -ForegroundColor Yellow
                Write-Host "      Or use 'npm install --force' to override conflicts" -ForegroundColor Yellow
                exit 1
            }
        }
        
        $ErrorActionPreference = "Stop"
        Write-Host "  [+] Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "  [+] Frontend dependencies already installed" -ForegroundColor Green
    }
} else {
    Write-Host "  [o] Skipped dependency installation" -ForegroundColor Gray
}

# Create .env file for frontend (optional)
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "  [+] .env file created from .env.example" -ForegroundColor Green
    } else {
        $frontendEnvLines = @(
            'VITE_API_URL=http://localhost:3000/api/v1',
            'VITE_WS_URL=http://localhost:3000'
        )
        $frontendEnvLines | Out-File -FilePath ".env" -Encoding UTF8
        Write-Host "  [+] .env file created with default settings" -ForegroundColor Green
    }
} else {
    Write-Host "  [+] .env file already exists" -ForegroundColor Green
}

Write-Host ""

# Function to check if a process is running on a port and belongs to our project
function Test-ProjectProcessOnPort {
    param(
        [int]$Port,
        [string]$ProjectPath,
        [string[]]$ProcessNames = @('node', 'tsx', 'vite')
    )
    
    # First check if port is in use
    $portInUse = $false
    $portPids = @()
    
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen,Established -ErrorAction SilentlyContinue
        if ($connections) {
            $portPids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
            $portInUse = $true
        }
    } catch {}
    
    if (-not $portInUse) {
        return $false
    }
    
    # Check if any process on this port is from our project
    foreach ($processId in $portPids) {
        try {
            $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($proc) {
                # Check if it's one of our process types
                if ($proc.ProcessName -in $ProcessNames) {
                    # Check command line to see if it's from our project
                    $procInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
                    if ($procInfo -and $procInfo.CommandLine) {
                        $cmdLine = $procInfo.CommandLine
                        if ($cmdLine -like "*$ProjectPath*" -or $cmdLine -like "*shift-manager*") {
                            return $true
                        }
                    }
                }
            }
        } catch {}
    }
    
    # Also check for PowerShell processes that might be running our scripts
    try {
        $psProcs = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue
        foreach ($ps in $psProcs) {
            if ($ps.CommandLine -and (
                $ps.CommandLine -like "*shift-manager-backend*" -or
                $ps.CommandLine -like "*$ProjectPath*server*" -and $ps.CommandLine -like "*npm run dev*"
            )) {
                # Check if this PowerShell has a child process on our port
                $childProcs = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($ps.ProcessId)" -ErrorAction SilentlyContinue
                foreach ($child in $childProcs) {
                    if ($child.ProcessName -in $ProcessNames) {
                        $childConnections = Get-NetTCPConnection -OwningProcess $child.ProcessId -ErrorAction SilentlyContinue
                        if ($childConnections | Where-Object { $_.LocalPort -eq $Port }) {
                            return $true
                        }
                    }
                }
            }
        }
    } catch {}
    
    return $false
}

# Step 4: Start backend
Write-Host "[5/7] Starting backend server..." -ForegroundColor Yellow

# Ensure we're in project root
Set-Location $ProjectRoot

# Check if backend is already running (check both port and process)
$backendRunning = Test-ProjectProcessOnPort -Port 3000 -ProjectPath $ProjectRoot -ProcessNames @('node', 'tsx')
if ($backendRunning) {
    Write-Host "  [+] Backend is already running on port 3000" -ForegroundColor Green
} else {
    # Check if port is in use by something else
    $portInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($portInUse) {
        Write-Host "  [!] Port 3000 is in use by another process. Please stop it first." -ForegroundColor Red
        Write-Host "      Use 'netstat -ano | findstr :3000' to find the process" -ForegroundColor Yellow
    } else {
        Write-Host "  -> Starting backend server in new PowerShell window..." -ForegroundColor Cyan
        $serverPath = Join-Path $ProjectRoot "server"
        $backendScript = "cd '$serverPath'`r`n`$env:NODE_ENV='development'`r`nnpm run dev"
        $backendScript | Out-File -FilePath "$env:TEMP\shift-manager-backend.ps1" -Encoding UTF8
        
        Start-Process powershell -ArgumentList "-NoExit", "-File", "$env:TEMP\shift-manager-backend.ps1" -WindowStyle Normal
        Write-Host "  -> Waiting for backend to start..." -ForegroundColor Cyan
        Start-Sleep -Seconds 5
        Write-Host "  [+] Backend server started (http://localhost:3000)" -ForegroundColor Green
    }
}

Write-Host ""

# Step 5: Start frontend
Write-Host "[6/7] Starting frontend application..." -ForegroundColor Yellow

# Ensure we're in project root
Set-Location $ProjectRoot

# Check if frontend is already running (check both port and process)
$frontendRunning = Test-ProjectProcessOnPort -Port 5173 -ProjectPath $ProjectRoot -ProcessNames @('node', 'vite')
if ($frontendRunning) {
    Write-Host "  [+] Frontend is already running on port 5173" -ForegroundColor Green
} else {
    # Check if port is in use by something else
    $portInUse = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
    if ($portInUse) {
        Write-Host "  [!] Port 5173 is in use by another process. Please stop it first." -ForegroundColor Red
        Write-Host "      Use 'netstat -ano | findstr :5173' to find the process" -ForegroundColor Yellow
    } else {
        Write-Host "  -> Starting frontend server in new PowerShell window..." -ForegroundColor Cyan
        $frontendScript = "cd '$ProjectRoot'`r`n`$env:NODE_ENV='development'`r`nnpm run dev"
        $frontendScript | Out-File -FilePath "$env:TEMP\shift-manager-frontend.ps1" -Encoding UTF8
        
        Start-Process powershell -ArgumentList "-NoExit", "-File", "$env:TEMP\shift-manager-frontend.ps1" -WindowStyle Normal
        Write-Host "  -> Waiting for frontend to start..." -ForegroundColor Cyan
        Start-Sleep -Seconds 3
        Write-Host "  [+] Frontend server started (http://localhost:5173)" -ForegroundColor Green
    }
}

Write-Host ""

# Step 6: Final check
Write-Host "[7/7] Final check..." -ForegroundColor Yellow

# Ensure we're in project root
Set-Location $ProjectRoot

Start-Sleep -Seconds 5

# Check backend
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
Write-Host "  Project started successfully!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Available services:" -ForegroundColor White
Write-Host "  * Frontend:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "  * Backend:   http://localhost:3000" -ForegroundColor Cyan
Write-Host "  * Health:    http://localhost:3000/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test credentials:" -ForegroundColor White
Write-Host "  * Email:    admin@example.com" -ForegroundColor Cyan
Write-Host "  * Password: admin123" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop the project, use the stop.ps1 script" -ForegroundColor Yellow
Write-Host ""
