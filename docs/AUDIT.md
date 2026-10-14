# AUDIT — Project Compliance Audit Against docs/Rules.md

**Date:** 2026-10-13  
**Auditor:** Automated System Audit & Contract Verification Suite (Prompt 6)  
**Status:** Audited — 0 Confirmed Violations, Clean Verification  

---

## 1. Scope and Methodology

This audit inspects the entire FloodSight Himalaya codebase against the operational rules established in `docs/Rules.md`, `docs/PRD.md`, and the Track B Problem Statement.

Searches were conducted across all Python backend files, TypeScript/TSX frontend files, configuration files, and data fixtures.

---

## 2. Category Findings

### Category 1: Hardcoded Coordinates or Dates in `backend/` or `src/lib/` (Rules §1, §4)
*Requirement:* The automated pipeline must operate from user-provided `AOI + date` and must never hardcode coordinates, dates, or expected answers (excluding clearly identified mock files).

* **Search executed:** Regex patterns for geographic coordinates (`2[78]\.[0-9]{3,}`, `8[45]\.[0-9]{3,}`) and ISO dates (`202[0-9]-[0-1][0-9]-[0-3][0-9]`) across `backend/` and `src/lib/` excluding `mock` and `tests` directories.
* **Findings:** **None found.**
* **Analysis & Verification:**
  - `backend/app/routers/runs.py`: Bounding boxes and event dates are dynamically received from incoming `AnalyzeRequest` bodies (lines 50–55, 75–80).
  - `backend/app/store.py`: `run_pipeline` and mock storage use parameters supplied via request payload (lines 122–126, 175–182).
  - `backend/pipeline/result_builder.py`: Receives dynamic `bbox_tuple`, `event_date`, and `osm_snapshot_date` (lines 114–117).
  - `src/lib/api.ts` & `src/lib/queries.ts`: Pure API clients and query wrappers; no hardcoded geographic coordinates.
  - UI Initial State Check (`src/routes/index.tsx` line 46, 58–59): The New Analysis page provides a default preset bbox and default date values for initial form convenience, but all parameters are user-editable and can be redrawn arbitrarily. This is UI form defaults, not backend pipeline logic.
* **Result:** ✅ PASS (0 violations).

---

### Category 2: Forbidden Data as Pipeline Inputs (Rules §3, §14)
*Requirement:* `EMSR`, `UNOSAT`, or published damage maps must never be used as inputs to the mapping pipeline. They are permitted solely as independent validation references.

* **Search executed:** Case-insensitive search for `EMSR`, `UNOSAT`, and `damage map` across all source files.
* **Findings:**
  - `src/components/ValidationView.tsx` (lines 31, 36, 45, 66, 71)
  - `src/routes/validation.tsx` (line 11)
* **Analysis & Verification (Confirmed False Positives):**
  - All occurrences in `ValidationView.tsx` and `validation.tsx` are explicit validation UI displays.
  - The UI explicitly displays the compliance banner: `"Reference data was NOT used as input"` (line 36, line 71) and explains: `"Validation has not been computed for this run. It is only calculated after the analysis result is produced, using the EMSR927 reference as a check, never as an input"` (lines 44–46).
  - In `backend/`: Neither `EMSR` nor `UNOSAT` appears in any pipeline processing, preprocessing, ingestion, or detection code.
* **Result:** ✅ PASS (0 violations; reference usage strictly conforms to Rule §14).

---

### Category 3: API Keys, Tokens, Credentials, or Secrets (Rules §5, §20)
*Requirement:* No API keys, credentials, or secrets hardcoded or committed to git, and no server-side LLM keys exposed to the frontend bundle.

* **Search executed:** Regex patterns for credentials (`sk-ant-`, `Bearer `, `password=`, `api_key=`), environment files check, and bundle leak check via automated test `test_llm_api_key_not_in_frontend_bundle`.
* **Findings:** **None found.**
* **Analysis & Verification:**
  - `backend/.env` & `.env`: Contain only local development flags (`DEBUG=true`, `FASTAPI_PORT=8000`, `VITE_API_URL=http://localhost:8000`). No secrets or API keys are stored.
  - `backend/.env.example` & `.env.example`: Supply empty template fields (`LLM_API_KEY=`, `COPERNICUS_USER=`, etc.) with explicit security guidance (`never commit .env to git`).
  - Automated test `backend/tests/test_copilot.py::test_llm_api_key_not_in_frontend_bundle`: Scans all frontend files in `src/` to assert that no API keys or Anthropic client configurations exist in the client.
* **Result:** ✅ PASS (0 violations).

---

### Category 4: Unlabelled or Ungrounded Numbers in `src/` (Rules §5, §19)
*Requirement:* All displayed statistics and counts must derive from the verified pipeline `RunResult` JSON or be explicitly labelled demo/mock values.

* **Search executed:** Audit of all dashboard and KPI presentation components (`KpiCards.tsx`, `ReportPreview.tsx`, `DamageTables.tsx`, `CutoffList.tsx`, `MethodsPage.tsx`).
* **Findings:** **None found.**
* **Analysis & Verification:**
  - `KpiCards.tsx`: Every KPI number is read directly from `k: Kpis` (`floodedAreaKm2`, `debrisAreaKm2`, `buildingsLikelyHit`, `roadLengthAffectedKm`, `bridgesLikelyDamaged`, `villagesCutOff`). Fallback is `"Not available"`.
  - `ReportPreview.tsx`: In mock mode, clearly labelled with header `"Educational prototype · sample data"` and renders numbers from `data.run.kpis`. In live mode, renders markdown generated by the verified backend copilot with numbered tool source links.
  - `DamageTables.tsx` & `CutoffList.tsx`: Read strictly from `run.buildings`, `run.roads`, `run.bridges`, and `run.villages`.
  - `MethodsPage.tsx`: Static educational text with no invented statistics.
* **Result:** ✅ PASS (0 violations).

---

### Category 5: Overstating Damage Language (Rule §11)
*Requirement:* At ~10 m Sentinel-1 resolution, the system must not claim "destroyed" or "collapsed" based solely on raster overlap. Must use "estimated affected", "likely hit", or "likely damaged".

* **Search executed:** Case-insensitive search for `destroy`, `destroyed`, `collaps`, `collapsed` across all source code.
* **Findings:**
  - `backend/pipeline/reporting/prompts.py` (lines 25, 29, 52): Explicit negative instructions in LLM system prompts:
    - `"Use 'estimated affected' or 'likely hit', never 'destroyed' or 'collapsed'."`
    - `"अनुमानित प्रभावित वा सम्भावित प्रभावित प्रयोग गर्नुहोस्; ध्वस्त वा भत्किएको होइन।"`
  - `backend/pipeline/contracts.py` (line 179): Docstring citing Rule 11: `"Rules §11: at ~10 m resolution use 'estimated affected', not 'destroyed'."`
  - `src/components/ui/sidebar.tsx`, `src/components/ui/collapsible.tsx`, `src/components/AppShell.tsx`: UI collapsible panel states (`isCollapsed`, `collapsible`, etc.) — confirmed false positives for UI component mechanics.
  - `src/lib/types.ts` & `backend/app/schemas.py`: Building status is strictly typed as `Status = "likely_hit" | "not_hit"`. Road status is `"flooded" | "intact"`. Bridge status is `"damaged" | "intact"`.
* **Result:** ✅ PASS (0 violations; language strictly adheres to Rule §11).

---

## 3. Corrective Actions and Fixes

During the Prompt 6 implementation and verification process:
1. **Frontend-Backend Contract Test & Prettier/TypeScript alignment**:
   - Fixed `src/test/contract.test.ts` to adhere to `@typescript-eslint/no-explicit-any` and `noPropertyAccessFromIndexSignature` (`jsonSchema["$defs"]`).
   - Confirmed schema file generation and verified deliberate mismatch detection for missing fields and nullability discrepancies.
2. **Deterministic Schema Exporter**:
   - Created `backend/scripts/export_schema.py` to deterministically serialize `RunResult.model_json_schema()` to `backend/data/runresult.schema.json`.

---

## 4. Verification Check Suite Status

The automated cross-verification script `scripts/check-all.ps1` and `scripts/check-all.sh` executed all 6 checks in order:

| Step | Check Name | Command | Exit Code | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | Frontend lint | `npm run lint` | 0 | ✅ PASSED |
| 2 | TypeScript type-check | `npx tsc --noEmit` | 0 | ✅ PASSED |
| 3 | Frontend Vitest tests | `npm test` | 0 | ✅ PASSED (14/14 tests) |
| 4 | Backend Ruff checks | `ruff check backend` | 0 | ✅ PASSED |
| 5 | Backend pytest tests | `pytest backend/tests -v` | 0 | ✅ PASSED (45/45 tests) |
| 6 | Contract check | `npm run contract:check` | 0 | ✅ PASSED (4/4 tests) |
