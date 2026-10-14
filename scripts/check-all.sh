#!/usr/bin/env bash
# scripts/check-all.sh — Full project verification script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

echo "=== Running check-all verification suite (Bash) ==="
echo "Working directory: $REPO_ROOT"

# 1. Frontend lint
echo ""
echo "---> Running Step 1: Frontend lint..."
npm run lint || { echo "FAILED: Step 1 (Frontend lint) failed"; exit 1; }
echo "PASSED: Step 1: Frontend lint"

# 2. TypeScript type-check
echo ""
echo "---> Running Step 2: TypeScript type-check..."
npx tsc --noEmit || { echo "FAILED: Step 2 (TypeScript type-check) failed"; exit 1; }
echo "PASSED: Step 2: TypeScript type-check"

# 3. Frontend Vitest tests
echo ""
echo "---> Running Step 3: Frontend Vitest tests..."
npm test || { echo "FAILED: Step 3 (Frontend Vitest tests) failed"; exit 1; }
echo "PASSED: Step 3: Frontend Vitest tests"

# 4. Backend Ruff checks
echo ""
echo "---> Running Step 4: Backend Ruff checks..."
if [ -f "$REPO_ROOT/backend/.venv/bin/ruff" ]; then
    RUFF_CMD="$REPO_ROOT/backend/.venv/bin/ruff"
elif [ -f "$REPO_ROOT/backend/.venv/Scripts/ruff.exe" ]; then
    RUFF_CMD="$REPO_ROOT/backend/.venv/Scripts/ruff.exe"
else
    RUFF_CMD="ruff"
fi
"$RUFF_CMD" check backend || { echo "FAILED: Step 4 (Backend Ruff checks) failed"; exit 1; }
echo "PASSED: Step 4: Backend Ruff checks"

# 5. Backend pytest tests
echo ""
echo "---> Running Step 5: Backend pytest tests..."
if [ -f "$REPO_ROOT/backend/.venv/bin/pytest" ]; then
    PYTEST_CMD="$REPO_ROOT/backend/.venv/bin/pytest"
elif [ -f "$REPO_ROOT/backend/.venv/Scripts/pytest.exe" ]; then
    PYTEST_CMD="$REPO_ROOT/backend/.venv/Scripts/pytest.exe"
else
    PYTEST_CMD="pytest"
fi
"$PYTEST_CMD" backend/tests -v || { echo "FAILED: Step 5 (Backend pytest tests) failed"; exit 1; }
echo "PASSED: Step 5: Backend pytest tests"

# 6. Contract check
echo ""
echo "---> Running Step 6: Contract check..."
npm run contract:check || { echo "FAILED: Step 6 (Contract check) failed"; exit 1; }
echo "PASSED: Step 6: Contract check"

echo ""
echo "=== SUCCESS: All 6 verification checks passed! ==="
exit 0
