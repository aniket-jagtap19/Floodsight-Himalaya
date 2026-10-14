# PHASES --- 15-Day Implementation Plan

## Project Goal

Deliver a working end-to-end prototype:

```text
AOI + event date
      ↓
Satellite acquisition
      ↓
Flood/debris detection
      ↓
Infrastructure impact
      ↓
Road connectivity
      ↓
Verified results
      ↓
AI report
      ↓
Dashboard
```

---

# Phase 0 --- Day 1: Team Setup and Technical Baseline

## Objectives

- finalize architecture
- create repository
- configure Python environment
- confirm Copernicus access
- confirm geospatial libraries
- understand raster/vector/CRS.

## Tasks

### Team

Assign:

**Member 1 --- Remote Sensing** - Sentinel-1 acquisition -
preprocessing - flood detection

**Member 2 --- Geospatial/Network** - OSM - spatial intersections - road
graph - cut-off analysis

**Member 3 --- Backend/AI** - pipeline orchestration - result JSON - AI
copilot - report generation

**Member 4 --- Dashboard/Evaluation** - map UI - evaluation - testing -
demo/report support.

Everyone should understand the complete pipeline.

## Deliverable

Repository runs locally.

---

# Phase 1 --- Day 1--2: Data Acquisition

## Goal

Given:

```text
bbox + event_date
```

find suitable satellite scenes automatically.

## Sentinel-1 tasks

Implement:

- AOI search
- time-window search
- product filtering
- orbit filtering
- polarization filtering
- acquisition metadata storage.

Store:

```json
{
  "event_date": "YYYY-MM-DD",
  "before": {
    "product_id": "...",
    "acquisition_time": "...",
    "orbit": "...",
    "relative_orbit": "...",
    "polarization": "..."
  },
  "after": {
    "product_id": "...",
    "acquisition_time": "...",
    "orbit": "...",
    "relative_orbit": "...",
    "polarization": "..."
  }
}
```

## Checkpoint

Do not continue until the team can automatically select a valid
before/after pair for at least one test area.

---

# Phase 2 --- Day 2--3: SAR Preprocessing

## Goal

Convert selected imagery into comparable analysis-ready rasters.

## Processing

Depending on chosen data access path:

- obtain GRD/appropriate processed product
- calibration/backscatter preparation
- noise handling
- optional speckle filtering
- terrain correction/orthorectification
- resampling/alignment
- nodata masking.

## Output

```text
before_vv.tif
after_vv.tif
before_vh.tif
after_vh.tif
quality_mask.tif
```

Not every file must exist if the selected API/product supplies only the
required bands.

## Checkpoint

Visualize before and after images on the same grid.

---

# Phase 3 --- Day 3--5: Flood Detection MVP

## Goal

Produce the first usable flood map.

## Baseline

1.  read before raster
2.  read after raster
3.  convert to comparable scale
4.  calculate change
5.  threshold
6.  clean small/noisy regions
7.  apply quality mask
8.  optionally apply terrain filters
9.  save flood raster.

Concept:

```text
change = log(after) - log(before)
```

Threshold can begin with Otsu or another documented automatic method.

## Important

Do not spend Day 3--5 building a complex neural network.

First get the deterministic baseline working.

## Deliverables

```text
flood_mask.tif
flood_polygons.geojson
flood_stats.json
```

## Checkpoint

The dashboard or a simple map should show a recognizable flood/change
corridor.

---

# Phase 4 --- Day 5--6: Terrain and False-Positive Reduction

## Goal

Improve Himalayan robustness.

## Add

- DEM
- slope filtering
- radar shadow/quality handling where available
- elevation plausibility
- optional HAND/drainage constraint
- morphology/noise cleanup.

## Test

Compare:

```text
raw change mask
        vs
terrain-filtered mask
```

Record false-positive changes.

## Deliverable

A documented filtering pipeline.

---

# Phase 5 --- Day 6--7: OSM Exposure Mapping

## Goal

Answer:

> What infrastructure was likely affected?

## Data

Retrieve pre-event OSM snapshot.

Extract:

- buildings
- roads
- bridges
- settlements
- hospitals/towns if available.

## Geometry

Ensure all layers use compatible CRS.

## Intersections

```text
flood polygons
      +
OSM buildings
      ↓
affected buildings
```

Same for roads and bridges.

## Metrics

Produce:

- affected building count
- affected road length
- affected bridge count.

## Deliverables

```text
affected_buildings.geojson
affected_roads.geojson
affected_bridges.geojson
exposure_stats.json
```

---

# Phase 6 --- Day 8--9: Cut-Off Settlement Analysis

## Goal

Answer:

> Who is cut off?

## Graph

```text
OSM road network
     ↓
nodes + edges
```

Mark event-affected edges.

Option A:

Remove affected edges.

Option B:

Give affected edges an extremely high cost.

Start with Option A because it is simpler and easier to explain.

## Connectivity

For each settlement:

```text
settlement
    ↓
nearest hospital/town
    ↓
road path?
```

If no path:

```text
ROAD-ISOLATED
```

## Deliverables

```text
cutoff_settlements.geojson
connectivity.json
```

Each record should include:

```json
{
  "settlement": "...",
  "destination": "...",
  "connected_before": true,
  "connected_after": false,
  "status": "cut_off"
}
```

---

# Phase 7 --- Day 9--10: Data Contract and Backend Orchestration

## Goal

Connect modules without manual copying.

Create one verified event result:

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

This becomes the source for:

- dashboard
- report
- AI.

## Checkpoint

Run the complete pipeline from one command.

---

# Phase 8 --- Day 10--11: Situation-Report Copilot

## Goal

Build grounded AI.

## Architecture

```text
User question
      ↓
question interpretation
      ↓
query verified result JSON
      ↓
LLM receives verified facts
      ↓
answer
```

## Supported example questions

- Which settlements are cut off?
- How many buildings are estimated to be affected?
- Which roads are affected?
- Which hospital is no longer reachable by road?
- What is the detected flood area?
- Give me a short situation report.
- Translate the report to Nepali.

## Guardrail

The model must refuse to provide an unverified number.

Example:

```text
User:
How many people are trapped?

System:
Population/trapped-person data is not available
from the verified analysis, so I cannot provide
a reliable number.
```

---

# Phase 9 --- Day 11--13: Dashboard

## Recommended MVP

Streamlit + Folium/Leaflet.

Why:

- fastest development
- Python integration
- easy map layers
- suitable for a 15-day prototype.

Potential later alternative:

React + Leaflet.

Do not migrate to React unless the MVP is already stable.

## Dashboard layout

### Top

- project title
- AOI
- event date
- processing status

### Main map

Layers:

- Sentinel-1 before
- Sentinel-1 after
- flood/debris
- roads
- buildings
- bridges
- cut-off settlements
- hospitals/towns.

### Side panel

- flood area
- affected buildings
- affected road km
- affected bridges
- cut-off settlements
- image dates
- quality warnings.

### AI panel

Question box + answer.

### Report

Generate/download the one-page report.

---

# Phase 10 --- Day 13: Second-Area Testing

## Critical milestone

Run the pipeline on a scene that was NOT used during development.

Test:

- image search
- pair selection
- preprocessing
- flood detection
- OSM overlay
- connectivity
- AI grounding.

Record failures.

This protects against Trishuli overfitting.

---

# Phase 11 --- Day 14: Evaluation and Hardening

## Flood evaluation

Where an allowed reference is available for validation:

calculate:

- precision
- recall
- IoU.

Do not use validation reference as an input.

## Robustness tests

Test:

- no cloud-free Sentinel-2
- poor Sentinel-1 coverage
- different AOI size
- no hospital in OSM
- incomplete road network
- no suitable before/after pair
- large flood region
- very small flood region.

## Fix

- crashes
- CRS errors
- invalid geometries
- missing-data handling
- bad UI labels
- unsupported assumptions.

---

# Phase 12 --- Day 15: Submission

## Final checklist

### Code

- repository clean
- README complete
- environment instructions
- `.env.example`
- no secrets
- pipeline runs.

### Dashboard

- clean map
- correct labels
- no hardcoded answer
- AI grounded.

### Report

Maximum 6 pages.

Include:

1.  problem
2.  architecture
3.  data
4.  methodology
5.  results
6.  AI component
7.  limitations
8.  case-study comparison.

### Demo

3 minutes.

Suggested sequence:

```text
0:00–0:20
Problem

0:20–0:45
Enter AOI + date

0:45–1:20
Satellite processing / flood map

1:20–1:45
Affected infrastructure

1:45–2:10
Cut-off settlements

2:10–2:35
Ask AI copilot

2:35–2:50
Situation report

2:50–3:00
Limitations + conclusion
```

---

# Priority Order

If time becomes short:

## MUST HAVE

1.  Sentinel-1 acquisition
2.  flood/change detection
3.  flood map
4.  pre-event OSM overlay
5.  affected roads/buildings/bridges
6.  road connectivity
7.  cut-off settlements
8.  grounded report
9.  dashboard
10. second-area test.

## SHOULD HAVE

- Sentinel-2 confirmation
- better terrain filtering
- quality/confidence layer
- polished UI
- English + Nepali report.

## NICE TO HAVE

- trained segmentation model
- HAND-based advanced filtering
- flood-path bonus
- sophisticated LLM tool calling
- advanced route visualization.

---

# Phase Completion Rule

For each phase:

```text
IMPLEMENT
    ↓
RUN
    ↓
TEST
    ↓
INSPECT
    ↓
FIX
    ↓
UPDATE MEMORY.md
    ↓
ZIP/project snapshot
```

Never move to the next phase merely because the code exists.
