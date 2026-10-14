# MEMORY --- Project State

## Purpose

This file is the persistent state of the Claude Project.

**MANDATORY:** Update this file after every completed implementation
task.

Do not delete useful historical decisions. Add a dated entry when a
major implementation decision or result changes the project state.

---

# 1. Current Project

**Hackathon:** Multimodal AI Hackathon 2026\
**Track:** B --- Mapping Flood Damage from Space\
**Duration:** 15 days\
**Team:** 4 members\
**Primary case study:** August 2026 Trishuli flood, Nepal

---

# 2. Current Status

**Overall status:** SKELETON & CONTRACT GUARD VERIFIED / READY FOR PHASE 1

## Completed

- Read and analyzed official Track B problem statement and rules.
- Defined architecture, data contracts, and phases.
- Full interactive frontend dashboard and report preview (mock and live modes).
- Full mock mode serving verified sample datasets with provenance tracking.
- Asynchronous analysis lifecycle with input spatial/temporal validation and polling.
- Live mode pipeline skeleton stopping deterministically at stage 1 with `failed_not_implemented`.
- Grounded AI copilot (`/ask` and `/report`) with strict numerical verification and offline `FakeLLM`.
- Automated frontend/backend contract test (`backend/scripts/export_schema.py`, `src/test/contract.test.ts`, `npm run contract:check`).
- End-to-end verification scripts (`scripts/check-all.ps1`, `scripts/check-all.sh`).
- Project compliance audit against `docs/Rules.md` (`docs/AUDIT.md`).

## What is NOT implemented (Real Satellite Analysis)

- **All real satellite-analysis stages are NOT yet implemented:**
  - No real Sentinel-1 scene discovery or query against Copernicus Data Space / Planetary Computer.
  - No real SAR preprocessing (calibration, speckle filtering, RTC, alignment).
  - No real SAR change detection / water and debris thresholding.
  - No real terrain filtering (Copernicus DEM slope / HAND masking).
  - No live OSM snapshot retrieval (Overpass / ohsome API).
  - No live road network graph construction or Dijkstra/BFS cut-off routing.
  - No real satellite imagery downloads or storage.

---

# 3. Source Requirements

The official challenge requires the system to accept an area and flood
date and answer:

- where the flood hit
- what infrastructure was damaged/affected
- who is cut off.

Required data inputs include:

- Sentinel-1
- Sentinel-2
- Copernicus DEM
- pre-event OSM
- permitted training datasets.

Forbidden as inputs:

- Copernicus EMS
- UNOSAT
- published damage maps
- post-event OSM edits.

The Trishuli case must be compared with EMSR927 for validation/checking.

---

# 4. Core Architecture Decision

Current architecture:

```text
AOI + Date
   ↓
Satellite acquisition
   ↓
SAR preprocessing
   ↓
Flood/debris detection
   ↓
Terrain filtering
   ↓
Flood polygons
   ↓
OSM exposure analysis
   ↓
Road graph connectivity
   ↓
Verified JSON
   ↓
Dashboard + AI report
```

---

# 5. AI Decision

## Current recommendation

**Situation-report copilot**

Reason:

- lower implementation risk
- aligns directly with required output
- allows strong AI component without training a large model
- keeps deterministic geospatial analysis as source of truth.

## Important

This is a project recommendation, not a mandatory challenge rule.

If the team later chooses flood segmentation:

- document the decision
- preserve the deterministic baseline
- test generalization on unseen Himalayan scenes.

---

# 6. Remote-Sensing Decisions

## Primary sensor

Sentinel-1 SAR.

Reason:

- works through clouds
- works day/night
- suitable for monsoon flood mapping.

## Supporting sensor

Sentinel-2 when clear.

## Baseline change detection

```text
change = log(after) - log(before)
```

## Threshold

Initial candidate:

Otsu automatic threshold.

## Terrain

Use Copernicus DEM.

Potential filters:

- slope
- radar shadow/terrain quality
- elevation plausibility
- HAND/drainage relation.

## Resolution limitation

Approximately 10 m-scale imagery means:

Do NOT claim individual structural collapse from simple intersection.

Use:

- estimated affected
- likely hit
- intersects detected affected area.

---

# 7. Satellite Pair Decision

For change detection:

Prefer:

- same relative orbit/track
- same acquisition mode
- same polarization
- comparable geometry
- suitable temporal relationship.

For the Trishuli case, the challenge recommends same-track images
approximately 12 days apart.

---

# 8. Current Technical Stack

Planned:

```text
Python
rasterio
numpy
scipy
geopandas
shapely
pyproj
networkx
GDAL where necessary
Streamlit
Folium/Leaflet
Copernicus Data Space APIs
ohsome API
LLM API
```

This stack is not fully locked until a first vertical slice is running.

---

# 9. Data Contracts

## Flood result

```json
{
  "event_date": "",
  "flood_area_km2": 0,
  "method": "",
  "threshold_method": "",
  "polygon_file": "",
  "quality": ""
}
```

## Exposure result

```json
{
  "buildings_estimated_affected": 0,
  "roads_affected_km": 0,
  "bridges_estimated_affected": 0
}
```

## Connectivity result

```json
{
  "settlements_analyzed": 0,
  "settlements_cut_off": 0,
  "records": []
}
```

## Combined verified result

```json
{
  "event": {},
  "satellite": {},
  "flood": {},
  "exposure": {},
  "connectivity": {},
  "quality": {},
  "limitations": []
}
```

---

# 10. Important Limitations

Already identified:

1.  Satellite revisit time is measured in days.
2.  This cannot provide minute-level early warning.
3.  SAR has terrain shadow/layover problems.
4.  Smooth/non-water surfaces can produce confusing radar responses.
5.  10 m resolution limits building-level claims.
6.  OSM can be incomplete.
7.  Road cut-off means mapped road connectivity only.
8.  Debris/water separation may be imperfect.
9.  Satellite availability/quality can vary.

---

# 11. Important Decisions Still Open

These must be experimentally decided:

### Remote sensing

- exact Sentinel-1 access path
- GRD vs processed/RTC product strategy
- VV only vs VV + VH
- exact speckle filter
- exact terrain filter
- HAND implementation
- polygon minimum area
- morphology settings.

### OSM

- exact ohsome query strategy
- feature tags
- settlement selection
- hospital/town destination selection.

### Connectivity

- edge removal vs high-cost edge
- affected-road ratio threshold
- route algorithm.

### Dashboard

- Streamlit MVP
- whether React is worth the additional time.

### AI

- exact LLM provider/API
- tool/function calling vs structured JSON prompt
- Nepali generation/evaluation.

---

# 12. Current Priority

The next implementation priority is:

## Vertical Slice

Build:

```text
AOI + date
   ↓
find Sentinel-1 before/after
   ↓
produce comparable raster
   ↓
basic change detection
   ↓
flood mask
   ↓
display map
```

Do NOT start with:

- polished dashboard
- advanced AI
- segmentation training
- bonus flood tracing.

The first objective is to prove that the satellite pipeline works on
real data.

---

# 13. Decision Log

## Decision 001

**Decision:** Treat deterministic geospatial processing as source of
truth.

**Reason:** Required numerical grounding and explainability.

**Status:** IMPLEMENTED AS ARCHITECTURAL PRINCIPLE.

---

## Decision 002

**Decision:** Start with situation-report copilot instead of custom
segmentation training.

**Reason:** 15-day constraint and lower implementation risk.

**Status:** RECOMMENDED; may be revisited.

---

## Decision 003

**Decision:** Primary flood sensor = Sentinel-1.

**Reason:** Cloud/day-night robustness and challenge emphasis.

**Status:** AGREED.

---

## Decision 004

**Decision:** Before/after comparisons should prioritize same orbit
track.

**Reason:** Different tracks can create artificial terrain/viewing-angle
changes.

**Status:** AGREED.

---

# 14. Implementation Log

## Entry Template

Copy this after each completed task:

```text
## YYYY-MM-DD — Task Name

Status:
IMPLEMENTED / TESTED / BLOCKED

### What changed
-

### Files changed
-

### Tests run
-

### Results
-

### Problems
-

### Decisions
-

### Next step
-
```

---

# 15. Current Next Step

**Next:** implement and test Sentinel-1 scene discovery for one small
AOI and one event date.

Success condition:

- system finds candidate before/after products
- metadata is captured
- same-track compatibility is checked
- selected pair can be passed to preprocessing.

---

# 16. Reminder to Claude

Before claiming a task is complete:

- run it
- inspect output
- test it
- update this file
- state limitations
- provide changed files/ZIP when appropriate.

Never invent an experimental result.

Never state that a model is accurate without testing it.

Never use forbidden validation products as pipeline inputs.

---

## 2026-10-10 — Prompt 1: Honest mock data and contract fixes

Status: IMPLEMENTED / TESTED

### What changed

- `src/lib/types.ts`: Added `T | null` for all fields that may be absent when
  real data is unavailable (`Village.population`, `Village.priority`,
  `Building/Road/Bridge/Village.confidence`, `Building/Road/Bridge/Village.reason`,
  `Building.distanceToRiverM`, `Kpis.peopleInCutOffVillages`, `RunResult.validation`).
  Added `RunResult.provenance`, `RunResult.quality`, `RunResult.limitations`.
  Added `PipelineStep.mock`. Added `metadata.model: string | null` and
  `metadata.dataMode: "mock" | "live" | "mixed"`. Added coordinate-convention comment.
- `src/data/mock-run.json`: Set `validation: null`, `metadata.model: null`,
  `pipelineVersion: "mock"`, `metadata.dataMode: "mock"`,
  `peopleInCutOffVillages: null`. All village `population: null`.
  Added 6-section `provenance` (all `"mock"`), `quality` object, and 10
  limitations from PRD section 12.
- `src/data/pipeline-steps.json`: Cleaned log text (no invented model names,
  no "Lee 5×5", no "HAND > 20 m", no "412 MB", no "1 084 km²"); added
  `"mock": true` to every step.
- `src/lib/api.ts`: Copilot canned answers removed fake bridge/population
  numbers; nullable `priority` and `distanceToRiverM` safely handled.
- `src/components/AppShell.tsx`: Header badge shows `t.mock` when
  `dataMode !== "live"`; per-section provenance on hover tooltip.
- `src/routes/dashboard.tsx`: Visible demo-data banner when any provenance
  is not `"live"`. Added `fitFlood` helper using `run.bbox`.
- `src/components/ValidationView.tsx`: Empty state when `run.validation` is
  null — metrics and map are hidden; note that reference is never an input.
- `src/components/KpiCards.tsx`: Removed population card; null values shown
  as "Not available".
- `src/components/CutoffList.tsx`: Population removed; nullable fields
  safely rendered.
- `src/components/DamageTables.tsx`: `conf` typed as `number | null`;
  null cells show "Not available".
- `src/components/ReportPreview.tsx`: Population and Kuro Siwo claim removed.
- `src/components/MethodsPage.tsx`: "Change detection (U-Net)" → "Change
  detection"; terrain FAQ removed specific slope/HAND thresholds; 10 m
  resolution claim made non-specific; Kuro Siwo removed from DATA table.
- `src/components/map/maps.tsx`: `FeaturePopup` accepts `number | null |
undefined` for `confidence` and shows "conf. Not available" when null;
  `ValidationMap` guards `run.validation?.referencePolygons ?? []`.
- `src/components/CopilotChat.tsx`: Suggested questions no longer ask about
  "most people"; replaced with village-isolation phrasing.
- `src/test/app-routing.test.tsx`: Added `await router.load()` before render
  so tests pass reliably in JSDOM without full SSR.

### Files changed

- src/lib/types.ts
- src/data/mock-run.json
- src/data/pipeline-steps.json
- src/lib/api.ts
- src/components/AppShell.tsx
- src/routes/dashboard.tsx
- src/components/ValidationView.tsx
- src/components/KpiCards.tsx
- src/components/CutoffList.tsx
- src/components/DamageTables.tsx
- src/components/ReportPreview.tsx
- src/components/MethodsPage.tsx
- src/components/map/maps.tsx
- src/components/CopilotChat.tsx
- src/test/app-routing.test.tsx

### Tests run

- `npx tsc --noEmit` — exit 0
- `npm run lint` — exit 0, 9 pre-existing fast-refresh warnings, 0 errors
- `npm run test` — exit 0, 2 tests passed (app-routing)

### Results

- TypeScript clean.
- Lint clean (only pre-existing warnings from Lovable-generated UI components).
- Tests pass.
- Dev server running on http://localhost:8082/ (confirmed HTTP 200).
- `/validation` shows "Validation not computed" empty state; metrics hidden.
- `/dashboard` shows demo-data banner; provenance badge in header.
- No U-Net, no "15°", no "20 m HAND", no "412 MB", no "1 084 km²", no
  fabricated bridge or population numbers anywhere in source or rendered UI.

### Problems

- Browser subagent unavailable (API quota exhausted) — screenshots not
  captured programmatically; visual verification was done through source-code
  inspection and dev-server confirmation.
- Pre-existing test JSDOM warning "In HTML, `<html>` cannot be a child of
  `<div>`" — benign; comes from TanStack Start SSR shell in JSDOM mode.

### Decisions

- All nullable fields use `T | null` (not optional) to comply with
  `exactOptionalPropertyTypes: true` in tsconfig.
- Kuro Siwo removed from MethodsPage DATA table: its role as optional
  training data for a model that is not yet implemented would be misleading.
- Mock badge in header uses `provenance` map, not a hard-coded flag.

### Next step

- Prompt 2 — Frontend API client (completed).

---

## 2026-10-10 — Prompt 2: Frontend API client (mock fallback, real HTTP when configured)

Status: IMPLEMENTED / TESTED

### What changed

- `src/lib/schemas.ts`: Created Zod schemas matching every interface in `src/lib/types.ts` (`SceneSchema`, `AreaPolygonSchema`, `BuildingSchema`, `RoadSchema`, `BridgeSchema`, `VillageSchema`, `FacilitySchema`, `KpisSchema`, `ValidationSchema`, `RunResultSchema`, `RecentRunSchema`, `CopilotAnswerSchema`, `PipelineStepSchema`, `RunStatusSchema`, `ReportDataSchema`). Added compile-time assertions ensuring bidirectional assignability with `types.ts`.
- `src/lib/http.ts`: Created fetch wrapper checking `import.meta.env["VITE_API_URL"]`, applying 15s timeout via `AbortController`, throwing typed `ApiError(status, message)`, validating response bodies against Zod schemas, and formatting the first three Zod issues on validation failure. Throws network error with configured server host.
- `src/lib/api.mock.ts`: Isolated all mock data handling into `api.mock.ts`. Re-exported `mockRun` so `mock-run.json` is imported strictly in this single file in the entire codebase.
- `src/lib/api.ts`: Delegated to `api.mock.ts` when `VITE_API_URL` is empty. Otherwise calling backend endpoints (`POST /api/analyze`, `GET /api/runs/{runId}/status`, `GET /api/runs/{runId}/result`, `GET /api/runs`, `POST /api/runs/{runId}/ask`, `GET /api/runs/{runId}/report`). Removed hardcoded month checks in `startAnalysis`; added bbox sanity checks (ordering and 5000 km² limit). Managed `activeRunId` state.
- `src/lib/app-context.tsx`: Integrated `activeRunId` and `setActiveRunId` into `AppProvider` context.
- `src/lib/queries.ts`: Updated `runQuery` to use `getActiveRunId()`. Added `useRunStatus(runId)` react-query hook polling every 1500 ms while `state` is `"queued"` or `"running"`, stopping when `"succeeded"` or `"failed"`, or when `query.state.status === "error"`.
- `src/components/PipelineStepper.tsx`: Extended `StepState` to include `"failed"` state with `XCircle` styling.
- `src/routes/index.tsx`: Removed the 12-day pre-computed date for the "before" scene; replaced with `"Selected automatically from available same-orbit scenes"`. Stepper polling driven by backend status in live mode. Added inline 422 error alerts, status=failed error card with failing step/log and Retry button, network error handling, and technical error panel for malformed responses.
- `.env.example`: Configured `VITE_API_URL=http://localhost:8000`.
- `README.md`: Added "Mock mode vs live mode" section detailing mock fallback and live API connection.
- `src/test/prompt2.test.tsx`: Added Vitest suite testing:
  1. `RunResultSchema` accepts `mock-run.json`.
  2. `RunResultSchema` rejects a copy with a missing `kpis` field.
  3. `apiFetch` throws `ApiError` on HTTP 500 and on malformed JSON response.
  4. `useRunStatus` stops polling when status becomes `"succeeded"`.
  5. `useRunStatus` stops polling when status query encounters an error.

### Files changed

- src/lib/schemas.ts (new)
- src/lib/http.ts (new)
- src/lib/api.mock.ts (new)
- src/lib/api.ts
- src/lib/app-context.tsx
- src/lib/queries.ts
- src/components/PipelineStepper.tsx
- src/routes/index.tsx
- .env.example
- README.md
- src/test/prompt2.test.tsx (new)
- docs/Memory.md

### Tests run

- `npx tsc --noEmit` — exit 0
- `npm run format` — exit 0
- `npm run lint` — exit 0 (0 errors, 9 pre-existing fast refresh warnings)
- `npm run test` — exit 0 (7 tests passed across 2 test files)

### Results

- TypeScript clean.
- ESLint clean.
- Vitest suite 7/7 passed.
- Mock mode operates identically with zero change in component invocation contracts.
- Status polling safely halts on `succeeded`, `failed`, or query error states (`query.state.status === "error"`).
- Only `src/lib/api.mock.ts` imports `mock-run.json`.

### Decisions

- Used index access `import.meta.env["VITE_API_URL"]` to comply with TS strict index signature rules.
- Maintained exact optional property types (`exactOptionalPropertyTypes`) across all Zod schema inferrals and API functions.
- `useRunStatus` `refetchInterval` returns `false` if `query.state.status === "error"`, `data.state === "succeeded"`, or `data.state === "failed"`.

### Next step

- Prompt 3 / next task.


---

## 2026-10-11 — Backend Skeleton (Prompt 3): FastAPI mock-passthrough, pytest 11/11, end-to-end verified

Status: IMPLEMENTED / TESTED / E2E-VERIFIED

### What changed

- `backend/pyproject.toml` (new): Python 3.11+ project; deps = `fastapi`, `uvicorn[standard]`, `pydantic>=2`, `python-dotenv`, `httpx`; dev deps = `pytest`, `pytest-asyncio`, `ruff`.
- `backend/.env.example` (new): Documents server env vars (`FASTAPI_HOST`, `FASTAPI_PORT`, `CORS_ORIGINS`, `DATA_DIR`, `ENVIRONMENT`, `DEBUG`) with empty placeholder values. No secrets.
- `backend/Dockerfile` (new): `python:3.12-slim`, installs package editable, runs uvicorn on `0.0.0.0:8000`.
- `backend/data/mock-run.json` (new): Copy of `src/data/mock-run.json`.
- `backend/data/pipeline-steps.json` (new): Copy of `src/data/pipeline-steps.json`.
- `backend/app/settings.py` (new): Loads `backend/.env` then root `.env` via `python-dotenv`. Parses `CORS_ORIGINS` (JSON list or CSV). Default CORS allows localhost:3000/5173/8080/8081/8082 and 127.0.0.1 equivalents.
- `backend/app/schemas.py` (new): Pydantic v2 models mirroring every interface in `src/lib/types.ts`. `model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)` for camelCase JSON serialization. Nullable fields are `Optional[T]` without defaults. Validators: bbox (`w < e`, `s < n`, lon `[-180,180]`, lat `[-90,90]`), date (`YYYY-MM-DD`), confidence (`[0,1]`). `AnalyzeRequest` rejects `osmDate >= floodDate` (422) and bbox > 5000 km² via equirectangular formula (422).
- `backend/app/mock_data.py` (new): Loads `mock-run.json` and `pipeline-steps.json` from `settings.data_dir`; validates against `RunResult` and `PipelineStep` Pydantic models.
- `backend/app/store.py` (new): `RunStore` abstract interface + `InMemoryRunStore`. `create_run` spawns a background asyncio coroutine advancing 9 pipeline steps (~8s total) until `state="succeeded"`. Pre-seeded with `run_2026-08-26_trishuli_a41f` (succeeded, mock result). `get_status`, `get_result`, `list_runs` implemented.
- `backend/app/routers/runs.py` (new): `POST /api/analyze` → 202 `{runId}`; `GET /api/runs/{runId}/status` → 200 `RunStatus`; `GET /api/runs/{runId}/result` → 200 `RunResult` (with `demoNote`); `GET /api/runs` → recent list; `POST /api/runs/{runId}/ask` → 501; `GET /api/runs/{runId}/report` → 501. `response_model_exclude_unset=True` throughout.
- `backend/app/main.py` (new): FastAPI app instance; CORSMiddleware (strict origin list, no wildcards); request-logging middleware (path, method, status, duration); global exception handlers for `HTTPException`, `RequestValidationError`, and unhandled `Exception` — all return `{"error": "..."}` JSON (never HTML tracebacks); mounts runs router; `/api/health` → `{"status":"ok"}`.
- `backend/app/__init__.py` (new): empty.
- `backend/tests/test_health.py` (new): `/api/health` returns 200 `{"status":"ok"}`.
- `backend/tests/test_runs.py` (new): 422 date ordering, 422 oversized bbox, 404 unknown run, lifecycle progression to `succeeded` (polling), 501 stubs.
- `backend/tests/test_schemas.py` (new): `mock-run.json` validates against `RunResult`; snapshot test confirms zero key drift with `exclude_unset=True`; bbox, date, confidence validators tested.
- `backend/tests/__init__.py`, `backend/tests/conftest.py` (new): pytest-asyncio mode auto; `TestClient` fixture.
- `backend/README.md` (new): Setup, run, test, Docker instructions; REST endpoint table.
- `backend/app/settings.py`: Added port 8081 to `DEFAULT_CORS_ORIGINS`.
- `.env` (root, gitignored): `VITE_API_URL=http://localhost:8000` — created locally for E2E test only; never committed.

### Files changed

- backend/ (entire new directory — pyproject.toml, Dockerfile, .env.example, README.md)
- backend/app/__init__.py, main.py, settings.py, schemas.py, mock_data.py, store.py
- backend/app/routers/__init__.py, runs.py
- backend/data/mock-run.json, backend/data/pipeline-steps.json
- backend/tests/__init__.py, conftest.py, test_health.py, test_runs.py, test_schemas.py
- .gitignore (already excluded backend/.venv/ and __pycache__)

### Tests run

- `pytest backend/tests -v` — **11 passed, 0 failed** (Python 3.14.3, pytest 9.1.1, pytest-asyncio 1.4.0)
- `ruff check backend` — **All checks passed**
- `npx tsc --noEmit` — **exit 0**
- `npm run test` — **7 passed** (2 test files: prompt2.test.tsx, app-routing.test.tsx)

### Results (E2E verification)

- FastAPI backend started on `http://127.0.0.1:8000`.
- `GET /api/health` → HTTP 200 `{"status":"ok"}` confirmed via PowerShell.
- Vite frontend started on `http://localhost:8081/` (port 8080 taken by Oracle TNSLSNR).
- Dashboard navigated directly to `/dashboard` via browser subagent.
- Dashboard displayed correctly: "Demo data" banner visible, "SAMPLE DATA" map badge, Terrain basemap, all layer toggles, impact metrics (Flooded area 6.8 km², Debris 2.3 km², Buildings 20/40, Road 21.5 km, Bridges 2/4, Villages 4/8).
- Backend logs confirm CORS preflight (`OPTIONS`) requests followed by successful `GET /api/runs/.../result → 200` from the frontend with no CORS errors.
- Header shows "Mock data" badge (correct — result carries `dataMode:"mock"`).
- No Zod schema validation errors in browser (run result accepted cleanly).

### Problems

- The browser subagent could not successfully click "Run analysis" button to trigger a brand-new `POST /api/analyze` call in the browser (scrolling ambiguity with the fixed-panel layout). The frontend instead loaded the pre-seeded run `run_2026-08-26_trishuli_a41f` directly from the backend via `/api/runs/.../result`.
- As a result, the stepper mid-run screenshot shows the form, not active step progression. The stepper animation with a live `POST /api/analyze` will be exercised in Prompt 4 when the UI flow is fully tested end-to-end.
- `GET /api/runs/.../report` correctly returns 501 (not yet implemented); frontend gracefully handles it.

### Decisions

- `response_model_exclude_unset=True` on result endpoint prevents extra null keys from leaking into JSON beyond what the contract specifies.
- Pre-seeded run avoids cold-start confusion in the dashboard when the user first lands on `/dashboard`.
- No real satellite, GIS, or ML libraries introduced; skeleton only.
- CORS origins are an explicit allowlist (no wildcards, no regex) as required by Rules.md §7.

### Next step

- Prompt 4 — Pipeline skeleton (complete; see entry below).

---

## 2026-10-12 — Pipeline Skeleton (Prompt 4): Honest stubs, not_implemented state, orchestrator, 10/10 tests

Status: IMPLEMENTED / TESTED / TSC-CLEAN

### What changed

**Backend — new files:**
- `backend/pipeline/__init__.py` — package root; exports `contracts`, `exceptions`, `orchestrator`.
- `backend/pipeline/contracts.py` — dataclass contracts: `BBox`, `ScenePair`, `Rasters`, `FloodMask`, `FloodPolygons`, `OSMSnapshot`, `ExposureResult`, `GraphResult`, `CutoffResult`, `ReportResult`. Each documents its input/output contract in a docstring.
- `backend/pipeline/exceptions.py` — `NotImplementedStage(detail: str)` exception. All stage stubs raise this.
- `backend/pipeline/config.py` — `Config` dataclass loaded from `backend/config/default.yaml`. Contains numeric constants used by future stage implementations.
- `backend/pipeline/result_builder.py` — `build_run_result(run_id, bbox, flood_date, osm_date)` builds a placeholder `RunResult` with `dataMode="not_implemented"` and provenance `"not_run"` for every field.
- `backend/pipeline/orchestrator.py` — `run_pipeline(run_id, bbox, flood_date, osm_date, use_optical, store, config)` coroutine. Advances `RunStatus` state to `"running"`, calls each stage in order, catches `NotImplementedStage` at stage 1, marks that step as `"not_implemented"`, and sets overall state to `"failed_not_implemented"` with an error message. Subsequent stages not reached.
- `backend/pipeline/acquisition/sentinel1.py` — `find_pair(bbox, event_date, config) -> ScenePair`. Raises `NotImplementedStage("Sentinel-1 scene acquisition has not been implemented.")`.
- `backend/pipeline/preprocessing/sar.py` — `prepare(scene_pair, bbox, config) -> Rasters`. Raises `NotImplementedStage`.
- `backend/pipeline/flood_detection/change_detection.py` — `run(rasters, config) -> FloodMask`. Raises `NotImplementedStage`.
- `backend/pipeline/flood_detection/polygonize.py` — `run(mask) -> FloodPolygons`. Raises `NotImplementedStage`.
- `backend/pipeline/exposure/osm.py` — `fetch_snapshot(bbox, osm_date) -> OSMSnapshot`. Raises `NotImplementedStage`.
- `backend/pipeline/exposure/intersect.py` — `run(osm, polygons) -> ExposureResult`. Raises `NotImplementedStage`.
- `backend/pipeline/connectivity/graph.py` — `build(osm) -> GraphResult`. Raises `NotImplementedStage`.
- `backend/pipeline/connectivity/cutoff.py` — `run(graph, affected_road_ids) -> CutoffResult`. Raises `NotImplementedStage`.
- `backend/pipeline/reporting/report.py` — `build(connectivity) -> ReportResult`. Raises `NotImplementedStage`.
- `backend/config/default.yaml` — numeric constants (SAR thresholds, OSM radius, etc.) for future use.
- `backend/tests/test_pipeline.py` — 3 tests: provenance constants, Config loads without error, orchestrator sets `failed_not_implemented` after stage 1.

**Backend — modified files:**
- `backend/app/settings.py` — added `PIPELINE_MODE: Literal["mock", "live"] = "mock"`.
- `backend/app/schemas.py` — `RunStatus.state` extended to include `"failed_not_implemented"`; `RunStatusStep.state` extended to include `"not_implemented"`.
- `backend/app/store.py` — `InMemoryRunStore.create_run` branches on `settings.pipeline_mode`: `"live"` → spawns `run_pipeline` coroutine; `"mock"` → existing mock advancement task.
- `backend/.env` — `PIPELINE_MODE=live` (local only, not committed).

**Frontend — modified files:**
- `src/lib/types.ts` — `RunStatus.state` union includes `"failed_not_implemented"`; `RunStatusStep.state` union includes `"not_implemented"`.
- `src/lib/schemas.ts` — `RunStatusSchema.state` and `RunStatusStepSchema.state` enums updated to match.
- `src/components/PipelineStepper.tsx` — `StepState` type includes `"not_implemented"`; renders amber "Not built yet" badge with `AlertCircle` icon for that state.
- `src/routes/index.tsx` — handles `failed_not_implemented` run state: shows "Pipeline Stage Not Built Yet" heading; `notImplementedStep` lookup; amber warning panel with stage name and log; live mode derives `liveSteps`, `liveStates`, `liveElapsed` from `statusData.steps`.
- `src/test/prompt4.test.tsx` — 3 tests: `RunStatusStepSchema` validates `not_implemented`, `RunStatusSchema` validates `failed_not_implemented`, `PipelineStepper` renders "Not built yet" badge.

### Tests run

- `npm run test` — **10 passed, 0 failed** (3 files: prompt4.test.tsx ×3, prompt2.test.tsx ×5, app-routing.test.tsx ×2)
- `npx tsc --noEmit` — **exit 0** (TS2532 optional-chain fix applied to `prompt4.test.tsx`)

### Decisions

- All pipeline stages raise `NotImplementedStage` rather than returning fake data, so the UI truthfully reflects what is built. No silent mock data in live mode.
- The orchestrator catches only the first stage failure; subsequent stages are not attempted (they would also raise `NotImplementedStage`), keeping the error state deterministic.
- `PIPELINE_MODE=live` in `backend/.env` (local); default in code is `"mock"` so the backend is safe without a `.env` file.
- `failed_not_implemented` is a distinct terminal state so the frontend can show a targeted "Not built yet" message rather than a generic failure banner.

### Stepper blank panel fix (2026-10-12)

Root cause: `liveSteps`/`liveStates` defaulted to `[]` until the first 1500 ms poll returned, producing a visibly blank stepper immediately after clicking Run.

Fix applied in `src/routes/index.tsx`:
- Added `livePlaceholderSteps: PipelineStep[]` state.
- After `setLiveRunId(res.runId)`, calls `getPipelineSteps()` (reads local `pipeline-steps.json`) and stores the steps with `log: "Queued…"` as placeholder.
- `liveSteps` and `liveStates` now fall back to `livePlaceholderSteps` / all `"pending"` when `statusData` is not yet available.
- `resetAnalysis()` clears `livePlaceholderSteps`.
- `getPipelineSteps()` in live mode is a local JSON read (no HTTP) so it resolves synchronously within the same microtask tick — no visible delay.

After fix: stepper renders all steps as "pending" instantly, then updates to `not_implemented` on the first poll.

### Prompt 4 final verification (2026-10-12) — all checks pass

Two defects found and fixed during verification:

**Defect 1 — Prettier errors in `src/routes/index.tsx`** (6 errors):  
The placeholder-steps patch introduced formatting that didn't match the project Prettier config: multi-line `.then().catch()` chaining and multi-line ternary continuations.  
Fix: Reformatted `.then().catch()` chain to proper chained style; collapsed `liveStates` / `liveElapsed` ternaries to single lines.

**Defect 2 — `test_analyze_lifecycle_and_status_progress` failed** (1 failure):  
The test asserts `state in ("queued", "running")` after a fresh `POST /api/analyze`, but with `PIPELINE_MODE=live` in `backend/.env` the pipeline stub completes instantly to `failed_not_implemented` before the test assertion.  
Fix: Added `monkeypatch.setattr(settings, "pipeline_mode", "mock")` so the test always exercises the mock lifecycle path. The live-mode path is already covered by `test_live_mode_via_store_setting` in `test_pipeline.py`.

**Final verified results:**

| Check | Result |
|-------|--------|
| `pytest backend/tests -v` | ✅ **17/17 passed** |
| `ruff check backend` | ✅ **All checks passed** |
| `npx tsc --noEmit` | ✅ **exit 0** |
| `npm run lint` | ✅ **0 errors** (9 pre-existing shadcn/ui warnings) |
| `npm run test` | ✅ **10/10 passed** |
| Mock mode: `dataMode: "mock"`, all provenance `"mock"`, clearly labelled | ✅ verified in `mock-run.json` and `store.py` |
| Live mode: stops at stage 1 with `failed_not_implemented`, no fabricated results | ✅ verified in `orchestrator.py` + `test_stubs_raise_not_implemented_stage` |
| New Analysis page shows amber "Not built yet" state | ✅ verified in `index.tsx` lines 320–338 |
| PipelineStepper never renders blank panel | ✅ fixed by placeholder pre-seed |
| Invalid polarization rejected by `SarConfig` | ✅ `test_config_rejects_unknown_polarization` passes |
| `build_result()` marks provenance `"live"` only when stage output exists | ✅ `test_build_result_provenance_live_vs_not_run` passes; code at `result_builder.py` lines 76–86 |
| API schemas: `failed_not_implemented` + `not_implemented` states | ✅ `backend/app/schemas.py` `RunStatus` and `RunStatusStep` |
| Frontend schemas: same states in `RunStatusSchema` and `RunStatusStepSchema` | ✅ `src/lib/schemas.ts` lines 236, 243 |
| `docs/Memory.md` records implementation and fixes | ✅ |

### Prompt 5: Grounded Copilot Endpoint (LLM Behind the Backend) (2026-10-13)

Implemented the grounded AI copilot endpoints (`POST /api/runs/{runId}/ask` and `GET /api/runs/{runId}/report?lang=`) strictly following FR-14, FR-15, Design §20–22, and Rules §5.

#### Components Implemented:
1. **Deterministic Tool Functions (`backend/pipeline/reporting/tools.py`)**:
   - `get_summary()`, `get_cutoff_villages()`, `get_damage_summary()`, `get_bridges()`, `get_scene_metadata()`, `get_limitations()`, `get_provenance()`.
   - Each tool extracts facts directly from `RunResult` and returns structured `ToolResult` with provenance `{layer, query, run_id}`. Never reads population (which is null) or hallucinates numbers.
2. **LLM Client Abstraction (`backend/pipeline/reporting/llm.py`)**:
   - `LLMClient` base class with `AnthropicClient` (real Claude API calls) and `FakeLLM` (offline deterministic responses for testing/mock mode).
   - `FakeLLM` guarantees no network calls (verified via socket mock test).
3. **Strict Grounding & Number Verification (`backend/pipeline/reporting/copilot.py`)**:
   - `verify_numbers(text, allowed)` extracts every numeric token in LLM output and validates it against numbers returned by tool functions.
   - Immediate refusal for unanswerable/forbidden questions (e.g., trapped people, casualties, exact population).
   - Populates source traceability map (`NumberSource`) linking output numbers to specific pipeline data layers.
4. **Report Generator (`backend/pipeline/reporting/report.py`)**:
   - Generates comprehensive markdown situation reports in English or Nepali.
   - Automatically prefixes `[DEMO / SYNTHETIC DATA]` when running against mock data.
   - Appends machine-translation disclaimer note for Nepali output.
5. **FastAPI Endpoints (`backend/app/routers/runs.py` & `schemas.py`)**:
   - `POST /api/runs/{run_id}/ask`: returns `CopilotAnswer` with sources, markdown, tools, and optional table/mini-map.
   - `GET /api/runs/{run_id}/report?lang=en|ne`: returns `CopilotAnswer` report.
   - LLM API key stays on the backend; never exposed to frontend bundles.
6. **Frontend Integration**:
   - `src/lib/api.ts`: Added `getLiveReport()`, updated `getReport()` for live and mock modes.
   - `src/components/ReportPreview.tsx`: Renders markdown report and Nepali disclaimer note in live mode, preserving rich static mock report in mock mode.
   - `src/components/CopilotChat.tsx`: Displays disclaimer notes and source attributions.

#### Verification & Test Results:
| Check | Result |
|-------|--------|
| `pytest backend/tests -v` | ✅ **45/45 passed** (including 29 new copilot tests) |
| `ruff check backend` | ✅ **All checks passed** (0 errors) |
| `npx tsc --noEmit` | ✅ **Exit code 0** (0 type errors) |
| `npm run lint` | ✅ **0 errors** (9 pre-existing shadcn/ui fast-refresh warnings) |
| `npm run test` | ✅ **10/10 passed** |
| FakeLLM no-network verification | ✅ `test_fakelm_makes_no_network_call` passes |
| Frontend API key leak check | ✅ `test_llm_api_key_not_in_frontend_bundle` passes |

### Prompt 6: Contract Guard and Full Verification (2026-10-13)

Implemented contract guard, cross-stack test suite, verification runner scripts, and project-wide rules audit.

#### 1. Components Implemented:
- **Pydantic Schema Exporter (`backend/scripts/export_schema.py`)**:
  - Deterministically exports `RunResult` model schema to `backend/data/runresult.schema.json`.
  - Runs cleanly from repo root or backend directory, auto-resolving virtual environment site-packages if needed.
- **Frontend/Backend Contract Guard (`src/test/contract.test.ts`)**:
  - Vitest test loading `backend/data/runresult.schema.json` and recursively verifying against Zod `RunResultSchema`.
  - Handles Pydantic `$ref` and `$defs`, nested objects, and arrays.
  - Verifies field names, types, and nullability, producing human-readable diff messages.
  - Verifies that schema file exists before test runs and confirms that deliberate drift (missing field or nullability mismatch) is actively detected.
- **Root NPM Script**:
  - Added `"contract:check": "python backend/scripts/export_schema.py && vitest run src/test/contract.test.ts"`.
- **Full Verification Scripts (`scripts/check-all.ps1`, `scripts/check-all.sh`)**:
  - Sequential runner: Frontend Lint $\to$ TypeScript Check $\to$ Frontend Tests $\to$ Backend Ruff $\to$ Backend Pytest $\to$ Contract Check.
  - Stops on first error with descriptive step failure message and non-zero exit code.
  - Both scripts tested and confirmed passing in the local environment.
- **Project Rules Audit (`docs/AUDIT.md`)**:
  - Audited against `docs/Rules.md` across all 5 mandatory categories:
    1. Hardcoded coordinates/dates in `backend/` or `src/lib/`: 0 found.
    2. Forbidden data (EMSR/UNOSAT) as inputs: 0 found (EMSR927 only in validation reference UI).
    3. Secrets/API keys: 0 found (bundle leak prevented and tested).
    4. Ungrounded numbers: 0 found (all metrics bound to verified run result).
    5. Overstating damage wording: 0 found ("likely hit", "likely damaged" strictly used).

#### 2. What Is NOT Implemented (Real Satellite Analysis):
- All real satellite-analysis stages are deliberately not implemented yet:
  - Real Sentinel-1 scene discovery / catalog querying against CDSE or Planetary Computer.
  - Real SAR preprocessing (radiometric calibration, terrain correction, speckle filtering).
  - Real change detection thresholding.
  - Live OSM querying via Overpass/ohsome API.
  - Real road graph construction and cut-off routing algorithms.
- Live mode pipeline stops cleanly at Stage 1 with `failed_not_implemented`.

#### 3. Remaining Limitations / Checks:
- `scripts/check-all.sh` requires Git Bash or a POSIX shell environment on Windows (native WSL currently lacks `/bin/bash` configuration on this host, but Git Bash executes `scripts/check-all.sh` with 100% success). `scripts/check-all.ps1` runs natively in PowerShell.

#### 4. Next Step

implement Sentinel-1 scene discovery for one small AOI and one date (Phase 1)

