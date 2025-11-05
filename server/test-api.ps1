# Тестовый скрипт для проверки API

Write-Host "=== Testing shift-manager API ===" -ForegroundColor Cyan

# 1. Health check
Write-Host "`n1. Testing health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method GET -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# 2. Login
Write-Host "`n2. Testing login endpoint..." -ForegroundColor Yellow
try {
    $body = @{
        email = "admin@shift-manager.com"
        password = "admin123"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/login" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -UseBasicParsing

    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $json = $response.Content | ConvertFrom-Json
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
    
    if ($json.success -and $json.data.token) {
        $global:token = $json.data.token
        Write-Host "Token received successfully!" -ForegroundColor Green
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# 3. Get schedules (requires token)
if ($global:token) {
    Write-Host "`n3. Testing get schedules endpoint..." -ForegroundColor Yellow
    try {
        $headers = @{
            "Authorization" = "Bearer $global:token"
        }
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/schedules" `
            -Method GET `
            -Headers $headers `
            -UseBasicParsing

        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "Response: $($response.Content)" -ForegroundColor Gray
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
    }
}

Write-Host "`n=== Tests completed ===" -ForegroundColor Cyan


