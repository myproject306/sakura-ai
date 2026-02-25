# Sakura AI - API Test Script
$BASE = "http://localhost:3001"

Write-Host "`n=== 1. Health Check ===" -ForegroundColor Cyan
$r = Invoke-RestMethod -Uri "$BASE/api/health" -Method GET
Write-Host "Status: $($r.status) | Service: $($r.service)" -ForegroundColor Green

Write-Host "`n=== 2. Register ===" -ForegroundColor Cyan
try {
    $body = @{ email = "test@sakura.com"; password = "Test1234!"; firstName = "Test"; lastName = "User" } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BASE/api/auth/register" -Method POST -Body $body -ContentType "application/json"
    Write-Host "Registered OK: user=$($r.user.email) plan=$($r.user.plan) credits=$($r.user.credits)" -ForegroundColor Green
    $TOKEN = $r.accessToken
} catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match "already") {
        Write-Host "User already exists - trying login..." -ForegroundColor Yellow
        $body = @{ email = "test@sakura.com"; password = "Test1234!" } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body $body -ContentType "application/json"
        Write-Host "Logged in: user=$($r.user.email)" -ForegroundColor Green
        $TOKEN = $r.accessToken
    } else {
        Write-Host "Error: $msg" -ForegroundColor Red
        $TOKEN = $null
    }
}

Write-Host "`n=== 3. Provider Status (no auth needed) ===" -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri "$BASE/api/tools/status" -Method GET
    Write-Host "Tools status: $($r | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "Status: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
}

if ($TOKEN) {
    Write-Host "`n=== 4. Tools List (authenticated) ===" -ForegroundColor Cyan
    try {
        $headers = @{ Authorization = "Bearer $TOKEN" }
        $r = Invoke-RestMethod -Uri "$BASE/api/tools/list" -Method GET -Headers $headers
        Write-Host "Tools: $($r | ConvertTo-Json -Depth 2)" -ForegroundColor Green
    } catch {
        Write-Host "Error: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}

Write-Host "`n=== 5. 404 Test ===" -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$BASE/api/nonexistent" -Method GET
} catch {
    Write-Host "404 correctly returned: $($_.ErrorDetails.Message)" -ForegroundColor Green
}

Write-Host "`n=== All Tests Done ===" -ForegroundColor Cyan
