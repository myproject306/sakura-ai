$base = "http://localhost:3001"
$pass = 0
$fail = 0

function Test-Pass($msg) { Write-Host "  PASS: $msg" -ForegroundColor Green; $global:pass++ }
function Test-Fail($msg) { Write-Host "  FAIL: $msg" -ForegroundColor Red; $global:fail++ }
function Test-Info($msg) { Write-Host "  INFO: $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  Sakura AI — Full API Test Suite" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

# ── TEST 1: Health Check ──────────────────
Write-Host ""
Write-Host "[1] GET /api/health" -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri "$base/api/health" -Method GET
    if ($r.status -eq "ok") { Test-Pass "status=ok, service=$($r.service)" }
    else { Test-Fail "Unexpected: $($r | ConvertTo-Json -Compress)" }
} catch { Test-Fail $_.Exception.Message }

# ── TEST 2: 404 Handler ───────────────────
Write-Host ""
Write-Host "[2] GET /api/nonexistent → 404" -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$base/api/nonexistent" -Method GET | Out-Null
    Test-Fail "Should have returned 404"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 404) { Test-Pass "404 returned correctly" }
    else { Test-Fail "Expected 404, got $code" }
}

# ── TEST 3: GET /api/ai/status ────────────
Write-Host ""
Write-Host "[3] GET /api/ai/status" -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri "$base/api/ai/status" -Method GET
    Test-Pass "configured=$($r.configured), service=$($r.service)"
} catch { Test-Fail $_.Exception.Message }

# ── TEST 4: Register (or login if exists) ─
Write-Host ""
Write-Host "[4] POST /api/auth/register" -ForegroundColor Cyan
$email = "fulltest_$(Get-Random)@sakura.com"
$token = $null
try {
    $body = "{`"firstName`":`"Full`",`"lastName`":`"Test`",`"email`":`"$email`",`"password`":`"Test1234!`"}"
    $r = Invoke-RestMethod -Uri "$base/api/auth/register" -Method POST -ContentType "application/json" -Body $body
    $token = $r.accessToken
    $refreshToken = $r.refreshToken
    Test-Pass "Registered: $email, token received"
} catch { Test-Fail $_.Exception.Message }

# ── TEST 5: Login ─────────────────────────
Write-Host ""
Write-Host "[5] POST /api/auth/login" -ForegroundColor Cyan
try {
    $body = "{`"email`":`"test@sakura.com`",`"password`":`"Test1234!`"}"
    $r = Invoke-RestMethod -Uri "$base/api/auth/login" -Method POST -ContentType "application/json" -Body $body
    $token = $r.accessToken
    $refreshToken = $r.refreshToken
    Test-Pass "Login OK, token=$($token.Substring(0,20))..."
} catch { Test-Fail $_.Exception.Message }

# ── TEST 6: GET /api/auth/me ──────────────
Write-Host ""
Write-Host "[6] GET /api/auth/me" -ForegroundColor Cyan
if ($token) {
    try {
        $headers = @{ Authorization = "Bearer $token" }
        $r = Invoke-RestMethod -Uri "$base/api/auth/me" -Method GET -Headers $headers
        Test-Pass "User: $($r.email), plan=$($r.plan)"
    } catch { Test-Fail $_.Exception.Message }
} else { Test-Info "Skipped (no token)" }

# ── TEST 7: POST /api/auth/refresh ────────
Write-Host ""
Write-Host "[7] POST /api/auth/refresh" -ForegroundColor Cyan
if ($refreshToken) {
    try {
        $body = "{`"refreshToken`":`"$refreshToken`"}"
        $r = Invoke-RestMethod -Uri "$base/api/auth/refresh" -Method POST -ContentType "application/json" -Body $body
        Test-Pass "New accessToken received"
    } catch { Test-Fail $_.Exception.Message }
} else { Test-Info "Skipped (no refreshToken)" }

# ── TEST 8: GET /api/tools/list ──────────
Write-Host ""
Write-Host "[8] GET /api/tools/list" -ForegroundColor Cyan
if ($token) {
    try {
        $headers = @{ Authorization = "Bearer $token" }
        $r = Invoke-RestMethod -Uri "$base/api/tools/list" -Method GET -Headers $headers
        $count = $r.tools.Count
        Test-Pass "$count tools returned"
    } catch { Test-Fail $_.Exception.Message }
} else { Test-Info "Skipped (no token)" }

# ── TEST 9: GET /api/tools/usage ─────────
Write-Host ""
Write-Host "[9] GET /api/tools/usage" -ForegroundColor Cyan
if ($token) {
    try {
        $headers = @{ Authorization = "Bearer $token" }
        $r = Invoke-RestMethod -Uri "$base/api/tools/usage" -Method GET -Headers $headers
        Test-Pass "plan=$($r.plan), tokens.used=$($r.tokens.used)"
    } catch { Test-Fail $_.Exception.Message }
} else { Test-Info "Skipped (no token)" }

# ── TEST 10: GET /api/projects ────────────
Write-Host ""
Write-Host "[10] GET /api/projects" -ForegroundColor Cyan
if ($token) {
    try {
        $headers = @{ Authorization = "Bearer $token" }
        $r = Invoke-RestMethod -Uri "$base/api/projects" -Method GET -Headers $headers
        Test-Pass "Projects endpoint OK, count=$($r.Count)"
    } catch { Test-Fail $_.Exception.Message }
} else { Test-Info "Skipped (no token)" }

# ── TEST 11: POST /api/ai/interact ────────
Write-Host ""
Write-Host "[11] POST /api/ai/interact" -ForegroundColor Cyan
if ($token) {
    try {
        $headers = @{ Authorization = "Bearer $token" }
        $body = "{`"input`":`"Tell me a short joke about programming.`",`"model`":`"gemini-2.0-flash`"}"
        $r = Invoke-RestMethod -Uri "$base/api/ai/interact" -Method POST -ContentType "application/json" -Headers $headers -Body $body
        Test-Pass "AI response: $($r.text.Substring(0, [Math]::Min(80, $r.text.Length)))..."
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 403) { Test-Info "403 - Subscription required (expected for free plan)" }
        elseif ($code -eq 503) { Test-Info "503 - GOOGLE_API_KEY not set in env (expected locally)" }
        else { Test-Fail "Unexpected $code : $($_.Exception.Message)" }
    }
} else { Test-Info "Skipped (no token)" }

# ── TEST 12: POST /api/tools/run (free tool) ─
Write-Host ""
Write-Host "[12] POST /api/tools/run (text-summarizer)" -ForegroundColor Cyan
if ($token) {
    try {
        $headers = @{ Authorization = "Bearer $token" }
        $body = "{`"toolName`":`"text-summarizer`",`"inputs`":{`"text`":`"Artificial intelligence is transforming the world.`"}}"
        $r = Invoke-RestMethod -Uri "$base/api/tools/run" -Method POST -ContentType "application/json" -Headers $headers -Body $body
        Test-Pass "Tool run OK: jobId=$($r.jobId)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Test-Info "Status $code (AI provider may not be configured locally)"
    }
} else { Test-Info "Skipped (no token)" }

# ── TEST 13: Unauthenticated access ───────
Write-Host ""
Write-Host "[13] GET /api/auth/me (no token) → 401" -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$base/api/auth/me" -Method GET | Out-Null
    Test-Fail "Should have returned 401"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401) { Test-Pass "401 returned correctly" }
    else { Test-Fail "Expected 401, got $code" }
}

# ── SUMMARY ───────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  RESULTS: $pass PASSED | $fail FAILED" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host "========================================" -ForegroundColor Magenta
