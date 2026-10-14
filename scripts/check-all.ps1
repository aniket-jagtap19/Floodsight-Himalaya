# scripts/check-all.ps1 — Full project verification script
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
Set-Location $RepoRoot

Write-Host "=== Running check-all verification suite (PowerShell) ===" -ForegroundColor Cyan
Write-Host "Working directory: $RepoRoot"

function Invoke-CheckStep {
    param(
        [string]$StepName,
        [scriptblock]$Action
    )
    Write-Host "`n---> Running $StepName..." -ForegroundColor Yellow
    & $Action
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nFAILED: $StepName failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "PASSED: $StepName" -ForegroundColor Green
}

# 1. Frontend lint
Invoke-CheckStep "Step 1: Frontend lint" {
    npm run lint
}

# 2. TypeScript type-check
Invoke-CheckStep "Step 2: TypeScript type-check" {
    npx tsc --noEmit
}

# 3. Frontend Vitest tests
Invoke-CheckStep "Step 3: Frontend Vitest tests" {
    npm test
}

# 4. Backend Ruff checks
$RuffCmd = if (Test-Path "$RepoRoot\backend\.venv\Scripts\ruff.exe") {
    "$RepoRoot\backend\.venv\Scripts\ruff.exe"
} else {
    "ruff"
}
Invoke-CheckStep "Step 4: Backend Ruff checks" {
    & $RuffCmd check backend
}

# 5. Backend pytest tests
$PytestCmd = if (Test-Path "$RepoRoot\backend\.venv\Scripts\pytest.exe") {
    "$RepoRoot\backend\.venv\Scripts\pytest.exe"
} else {
    "pytest"
}
Invoke-CheckStep "Step 5: Backend pytest tests" {
    & $PytestCmd backend/tests -v
}

# 6. Contract check
Invoke-CheckStep "Step 6: Contract check" {
    npm run contract:check
}

Write-Host "`n=== SUCCESS: All 6 verification checks passed! ===" -ForegroundColor Green
exit 0
