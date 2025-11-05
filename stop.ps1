# Full shutdown script for shift-Manager project
# Stops all running components: frontend, backend, database

$ErrorActionPreference = "Continue"

# Determine project root (directory of this script) and switch to it for docker compose
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $ProjectRoot

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Stopping shift-Manager Project" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

function Stop-ByPort {
	param(
		[int]$Port,
		[string]$Label
	)
	$stopped = $false
	$pids = @()
	
	# Method 1: Get-NetTCPConnection (primary method)
	try {
		$connections = Get-NetTCPConnection -LocalPort $Port -State Listen,Established -ErrorAction SilentlyContinue
		if ($connections) {
			$pids += $connections | Select-Object -ExpandProperty OwningProcess -Unique
		}
	} catch {}
	
	# Method 2: netstat as fallback (more reliable on some systems)
	if ($pids.Count -eq 0) {
		try {
			$netstatOutput = netstat -ano | Select-String ":$Port\s+.*LISTENING"
			foreach ($line in $netstatOutput) {
				$matches = [regex]::Matches($line, '\s+(\d+)\s*$')
				if ($matches.Count -gt 0) {
					$pid = [int]$matches[0].Groups[1].Value
					if ($pid -gt 0) {
						$pids += $pid
					}
				}
			}
		} catch {}
	}
	
	# Method 3: Also check for TIME_WAIT and other states
	try {
		$allConnections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
		if ($allConnections) {
			$allPids = $allConnections | Select-Object -ExpandProperty OwningProcess -Unique
			$pids += $allPids
		}
	} catch {}
	
	# Remove duplicates and invalid PIDs
	$pids = $pids | Where-Object { $_ -gt 0 } | Select-Object -Unique
	
	# Stop all found processes
	if ($pids.Count -gt 0) {
		foreach ($procId in $pids) {
			try {
				# Check if process still exists
				$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
				if ($proc) {
					Write-Host "  -> Stopping $Label process (PID: $procId, Name: $($proc.ProcessName))..." -ForegroundColor Cyan
					
					# Try graceful stop first
					try {
						$proc.Kill()
					} catch {
						# Fallback to Stop-Process
						Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
					}
					
					# Wait a bit and verify
					Start-Sleep -Milliseconds 500
					$procCheck = Get-Process -Id $procId -ErrorAction SilentlyContinue
					if ($procCheck) {
						# Force kill if still running
						Write-Host "    -> Force killing process..." -ForegroundColor Yellow
						Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
					}
					
					$stopped = $true
				}
			} catch {
				# Process might already be gone, that's okay
			}
		}
		
		# Additional cleanup: kill child processes that might be holding the port
		Start-Sleep -Milliseconds 300
		try {
			$remainingConnections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
			if ($remainingConnections) {
				$remainingPids = $remainingConnections | Select-Object -ExpandProperty OwningProcess -Unique
				foreach ($remainingPid in $remainingPids) {
					try {
						$remainingProc = Get-Process -Id $remainingPid -ErrorAction SilentlyContinue
						if ($remainingProc -and $remainingPid -notin $pids) {
							Write-Host "  -> Stopping remaining $Label process (PID: $remainingPid)..." -ForegroundColor Yellow
							Stop-Process -Id $remainingPid -Force -ErrorAction SilentlyContinue
							$stopped = $true
						}
					} catch {}
				}
			}
		} catch {}
	}
	
	return $stopped
}

function Stop-TempShellByScript {
	param([string]$ScriptFile)
	$found = $false
	try {
		# Method 1: Find PowerShell processes by script filename
		$procs = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { 
			$_.CommandLine -like "*${ScriptFile}*" -or $_.CommandLine -like "*shift-manager*"
		}
		foreach ($p in $procs) {
			Write-Host "  -> Closing shell for $ScriptFile (PID: $($p.ProcessId))..." -ForegroundColor Cyan
			Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
			$found = $true
		}
		
		# Method 2: Find by temp script path
		$tempScriptPath = "$env:TEMP\$ScriptFile"
		if (Test-Path $tempScriptPath) {
			$procs2 = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { 
				$_.CommandLine -like "*$tempScriptPath*"
			}
			foreach ($p in $procs2) {
				Write-Host "  -> Closing shell by script path (PID: $($p.ProcessId))..." -ForegroundColor Cyan
				Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
				$found = $true
			}
		}
		
		# Method 3: Find PowerShell windows with project paths in command line
		$projectPathEscaped = $ProjectRoot -replace '\\', '\\'
		$procs3 = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { 
			$_.CommandLine -like "*$projectPathEscaped*" -and $_.CommandLine -like "*npm run dev*"
		}
		foreach ($p in $procs3) {
			Write-Host "  -> Closing shell by project path (PID: $($p.ProcessId))..." -ForegroundColor Cyan
			Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
			$found = $true
		}
	} catch {
		# Ignore errors
	}
	return $found
}

function Stop-PowerShellWindowsByProject {
	# Additional cleanup: find any PowerShell windows that might be running the project
	$found = $false
	try {
		$currentProcessId = [System.Diagnostics.Process]::GetCurrentProcess().Id
		$projectPathEscaped = $ProjectRoot -replace '\\', '\\'
		$allPowerShell = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue
		
		foreach ($ps in $allPowerShell) {
			$cmdLine = $ps.CommandLine
			if ($cmdLine -and (
				$cmdLine -like "*shift-manager*" -or
				$cmdLine -like "*$projectPathEscaped*server*" -or
				($cmdLine -like "*$projectPathEscaped*" -and $cmdLine -like "*npm run dev*")
			)) {
				# Skip current PowerShell process
				if ($ps.ProcessId -ne $currentProcessId) {
					Write-Host "  -> Closing stray PowerShell window (PID: $($ps.ProcessId))..." -ForegroundColor Cyan
					Stop-Process -Id $ps.ProcessId -Force -ErrorAction SilentlyContinue
					$found = $true
				}
			}
		}
	} catch {
		# Ignore errors
	}
	return $found
}

# Step 1: Stop frontend
Write-Host "[1/4] Stopping frontend server..." -ForegroundColor Yellow

$frontendStopped = Stop-ByPort -Port 5173 -Label "frontend"
if ($frontendStopped) {
	Write-Host "  [+] Frontend server stopped" -ForegroundColor Green
} else {
	Write-Host "  [+] Frontend server not running" -ForegroundColor Gray
}

# Close spawned PowerShell window (if any)
$frontendShellClosed = Stop-TempShellByScript -ScriptFile "shift-manager-frontend.ps1"

Write-Host ""

# Step 2: Stop backend
Write-Host "[2/4] Stopping backend server..." -ForegroundColor Yellow

$backendStopped = Stop-ByPort -Port 3000 -Label "backend"
if ($backendStopped) {
	Write-Host "  [+] Backend server stopped" -ForegroundColor Green
} else {
	Write-Host "  [+] Backend server not running" -ForegroundColor Gray
}

# Close spawned PowerShell window (if any)
$backendShellClosed = Stop-TempShellByScript -ScriptFile "shift-manager-backend.ps1"

# Best-effort: also stop any stray tsx/vite/node processes that might remain
Write-Host "  -> Checking for stray node/tsx/vite processes..." -ForegroundColor Cyan
foreach ($name in @('tsx','vite','node')) {
	$procs = Get-Process -Name $name -ErrorAction SilentlyContinue
	if ($procs) {
		foreach ($p in $procs) {
			$shouldStop = $false
			try {
				# Check if process is using our ports
				$connections = Get-NetTCPConnection -OwningProcess $p.Id -ErrorAction SilentlyContinue
				$usingOurPorts = $connections | Where-Object { $_.LocalPort -eq 3000 -or $_.LocalPort -eq 5173 }
				
				if ($usingOurPorts) {
					$shouldStop = $true
				} else {
					# Check if process is related to our project by checking command line
					$procInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)" -ErrorAction SilentlyContinue
					if ($procInfo) {
						$cmdLine = $procInfo.CommandLine
						if ($cmdLine -and (
							$cmdLine -like "*$ProjectRoot*" -or
							$cmdLine -like "*shift-manager*" -or
							($cmdLine -like "*npm run dev*" -and $cmdLine -like "*$ProjectRoot*")
						)) {
							$shouldStop = $true
						}
					}
				}
			} catch {}
			
			if ($shouldStop) {
				Write-Host "    -> Stopping $name (PID: $($p.Id))..." -ForegroundColor Cyan
				try {
					Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
					Start-Sleep -Milliseconds 200
					# Verify it's stopped
					$checkProc = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
					if ($checkProc) {
						Write-Host "      -> Force killing..." -ForegroundColor Yellow
						Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
					}
				} catch {}
			}
		}
	}
}

# Final cleanup: find and close any remaining PowerShell windows related to the project
Write-Host "  -> Checking for remaining PowerShell windows..." -ForegroundColor Cyan
$strayWindows = Stop-PowerShellWindowsByProject
if ($strayWindows) {
	Write-Host "  [+] Additional PowerShell windows closed" -ForegroundColor Green
}

Write-Host ""

# Step 3: Stop database
Write-Host "[3/4] Stopping PostgreSQL database..." -ForegroundColor Yellow

function Invoke-DockerComposeDown {
    $composeCmd = $null
    $useDockerComposeSubcommand = $false
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        $null = docker compose version 2>$null
        if ($LASTEXITCODE -eq 0) { 
            $composeCmd = "docker"
            $useDockerComposeSubcommand = $true
        }
    }
    if (-not $composeCmd -and (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        $composeCmd = "docker-compose"
    }
    if ($composeCmd) {
        if ($useDockerComposeSubcommand) {
            & $composeCmd compose down 2>&1 | Out-Null
        } else {
            & $composeCmd down 2>&1 | Out-Null
        }
        return $LASTEXITCODE
    }
    return 1
}

$containerOutput = docker ps -q -f name=shift-manager-db 2>&1
$containerRunning = $containerOutput -and $containerOutput -ne ""
if ($containerRunning) {
	Write-Host "  -> Stopping Docker container(s)..." -ForegroundColor Cyan
	$exit = Invoke-DockerComposeDown
	if ($exit -eq 0) {
		Write-Host "  [+] Database stopped" -ForegroundColor Green
	} else {
		Write-Host "  [!] Compose down failed. Attempting direct stop/remove..." -ForegroundColor Yellow
		$null = docker stop shift-manager-db 2>&1
		$null = docker rm shift-manager-db 2>&1
	}
} else {
	Write-Host "  [+] Database not running" -ForegroundColor Gray
}

Write-Host ""

# Step 4: Cleanup temporary files
Write-Host "[4/4] Cleaning up temporary files..." -ForegroundColor Yellow

$tempFiles = @(
	"$env:TEMP\shift-manager-backend.ps1",
	"$env:TEMP\shift-manager-frontend.ps1"
)

foreach ($file in $tempFiles) {
	if (Test-Path $file) {
		Remove-Item $file -Force -ErrorAction SilentlyContinue
	}
}

Write-Host "  [+] Temporary files cleaned" -ForegroundColor Green

Write-Host ""

# Final verification: check if ports are still in use
Write-Host "[Final] Verifying ports are free..." -ForegroundColor Yellow

$portsStillInUse = @()
foreach ($port in @(3000, 5173)) {
	$connections = Get-NetTCPConnection -LocalPort $port -State Listen,Established -ErrorAction SilentlyContinue
	if ($connections) {
		$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
		foreach ($pid in $pids) {
			try {
				$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
				if ($proc) {
					Write-Host "  [!] Port $port still in use by process $($proc.ProcessName) (PID: $pid)" -ForegroundColor Red
					Write-Host "      -> Attempting final kill..." -ForegroundColor Yellow
					Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
					Start-Sleep -Milliseconds 500
					$portsStillInUse += $port
				}
			} catch {}
		}
	}
	
	# Also check with netstat
	try {
		$netstatOutput = netstat -ano | Select-String ":$port\s+.*LISTENING"
		if ($netstatOutput) {
			foreach ($line in $netstatOutput) {
				$matches = [regex]::Matches($line, '\s+(\d+)\s*$')
				if ($matches.Count -gt 0) {
					$pid = [int]$matches[0].Groups[1].Value
					if ($pid -gt 0) {
						try {
							$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
							if ($proc) {
								Write-Host "  [!] Port $port still in use (netstat check) by process $($proc.ProcessName) (PID: $pid)" -ForegroundColor Red
								Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
								$portsStillInUse += $port
							}
						} catch {}
					}
				}
			}
		}
	} catch {}
}

if ($portsStillInUse.Count -eq 0) {
	Write-Host "  [+] Ports 3000 and 5173 are free" -ForegroundColor Green
} else {
	$uniquePorts = $portsStillInUse | Select-Object -Unique
	Write-Host "  [!] Warning: Some ports may still be in use: $($uniquePorts -join ', ')" -ForegroundColor Yellow
	Write-Host "      You may need to manually check and kill processes if needed" -ForegroundColor Yellow
}

# Wait for ports to fully release (Windows needs time)
Write-Host "  -> Waiting for ports to fully release..." -ForegroundColor Gray
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Project stopped successfully!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Additional information
Write-Host "Useful commands:" -ForegroundColor White
Write-Host "  * Start project:        .\start.ps1" -ForegroundColor Cyan
Write-Host "  * View containers:      docker ps" -ForegroundColor Cyan
Write-Host "  * Database logs:        docker logs shift-manager-db" -ForegroundColor Cyan
Write-Host "  * Remove DB data:       docker compose down -v" -ForegroundColor Yellow
Write-Host ""

Pop-Location
