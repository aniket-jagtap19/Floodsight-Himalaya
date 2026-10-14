# DESIGN --- Technical Architecture

## 1. Design Philosophy

The system has three conceptual layers:

```text
HAZARD
Where is the flood/debris?
        ↓
EXPOSURE
What infrastructure is affected?
        ↓
CONSEQUENCE
Which settlements are cut off?
```

A fourth layer communicates the result:

```text
VERIFIED RESULTS
        ↓
Dashboard + AI + Report
```

The deterministic geospatial engine is the source of truth.

---

# 2. High-Level Architecture

```text
┌──────────────────────────────┐
│           USER               │
│ AOI + event date             │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ DATA ACQUISITION             │
│ Copernicus Data Space        │
│ Sentinel-1 / Sentinel-2      │
│ Copernicus DEM               │
│ pre-event OSM / ohsome       │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ REMOTE SENSING ENGINE        │
│ preprocessing                │
│ change detection             │
│ terrain filtering            │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ FLOOD / DEBRIS LAYER         │
│ raster + polygons            │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ EXPOSURE ENGINE              │
│ OSM intersection             │
│ buildings / roads / bridges  │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ CONNECTIVITY ENGINE          │
│ road graph                   │
│ affected edges               │
│ shortest path / components   │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ VERIFIED RESULT STORE        │
│ JSON + GeoJSON + GeoTIFF     │
└───────┬──────────────────────┘
        │
        ├───────────────┐
        ↓               ↓
┌───────────────┐ ┌───────────────┐
│ DASHBOARD     │ │ AI COPILOT    │
│ Streamlit     │ │ grounded LLM  │
│ Folium/Leaflet│ │ report/Q&A    │
└───────────────┘ └───────────────┘
```

---

# 3. Recommended Technology Stack

## Language

Python 3.11/3.12 preferred depending on package compatibility.

## Raster

- rasterio
- numpy
- scipy
- GDAL where needed.

## Vector

- geopandas
- shapely
- pyproj

## Network

- networkx

## Satellite/API

- Copernicus Data Space APIs
- Sentinel Hub / openEO route where appropriate.

The Copernicus Data Space ecosystem currently provides catalog/API
access and Sentinel-1 processing options. Official documentation should
be checked during implementation because API details can change.

## Dashboard

MVP:

- Streamlit
- Folium/Leaflet.

## AI

Use the available LLM/API only for:

- report generation
- Q&A
- language transformation.

The LLM is not the flood detector.

---

# 4. Data Acquisition Design

## 4.1 Input

```json
{
  "bbox": [min_lon, min_lat, max_lon, max_lat],
  "event_date": "2026-08-26"
}
```

Potential future input:

```json
{
  "geometry": {...},
  "event_date": "..."
}
```

---

# 5. Sentinel-1 Scene Selection

## Selection objective

Find a before/after pair that minimizes differences unrelated to the
flood.

Priority:

1.  same coverage
2.  same relative orbit
3.  same acquisition mode
4.  same polarization
5.  similar viewing geometry
6.  close enough to event
7.  acceptable quality.

The challenge specifically warns that different tracks have different
terrain viewing angles and should not be compared pixel-by-pixel.

---

# 6. Sentinel-1 Polarization Design

Sentinel-1 commonly provides:

- VV
- VH

for dual-polarization land acquisitions such as IW.

Initial implementation:

### Primary

VV

### Secondary

VH

Do not blindly combine them until behavior is tested on the selected
Himalayan scenes.

Potential features:

```text
VV_before
VV_after
VH_before
VH_after

VV_change
VH_change
VV/VH relationship
```

A later enhancement may combine channels into a rule-based score.

---

# 7. Sentinel-1 Processing

## Option A --- Use appropriately processed Copernicus products/services

This can reduce local processing complexity.

For example, Copernicus documentation describes Sentinel-1 GRD
processing involving:

- calibration
- thermal-noise handling
- optional speckle filtering
- optional radiometric terrain correction
- optional orthorectification.

Document exactly which processing has already occurred.

## Option B --- Local processing

If required, process the downloaded GRD product with a suitable SAR
processing workflow.

Do not implement a complicated SAR processor from scratch.

---

# 8. Change Detection

Baseline:

```text
before = SAR backscatter before event
after  = SAR backscatter after event

change = log(after) - log(before)
```

Interpretation:

```text
large negative change
        ↓
newly dark
        ↓
possible flood
```

But:

```text
change ≠ automatically flood
```

because radar geometry, vegetation, soil moisture, agricultural change,
and other effects can produce changes.

---

# 9. Thresholding

Baseline:

**Otsu thresholding**

Process:

```text
change image
     ↓
histogram
     ↓
Otsu threshold
     ↓
binary candidate mask
```

If Otsu performs poorly, allow configurable alternatives.

Never hardcode a threshold only because it worked on Trishuli.

---

# 10. Filtering

## 10.1 Nodata

Remove pixels without valid data.

## 10.2 Speckle

Use a documented filter or multi-temporal approach.

Avoid excessive smoothing that destroys narrow flood channels.

## 10.3 Morphology

Optional:

- opening
- closing
- small-region removal.

Use conservative settings.

## 10.4 Terrain

Use DEM-derived:

- slope
- elevation
- drainage-relative information
- radar shadow/quality information when available.

## 10.5 Water plausibility

Prefer changes that are:

- near drainage
- low relative to surrounding terrain
- spatially coherent.

HAND may be added if implementation time permits.

---

# 11. Flood vs Debris

The system should not pretend that every flood-related change is water.

Two conceptual categories:

### Water-like change

Often:

- large negative backscatter change
- dark SAR response
- connected to drainage/floodplain.

### Debris-like change

May involve:

- roughness change
- strong backscatter change
- newly altered terrain/surface.

Because debris classification is harder, output should be conservative.

Recommended terminology:

```text
Detected flood/debris-affected area
```

rather than:

```text
perfectly classified flood water
```

when the method cannot separate them reliably.

---

# 12. Polygonization

```text
flood_mask.tif
      ↓
connected regions
      ↓
vector polygons
      ↓
flood_polygons.geojson
```

Clean:

- tiny noise polygons
- invalid geometry
- duplicate geometry.

Keep original raster as the analytical source.

---

# 13. Area Calculation

Do not calculate area directly from longitude/latitude degrees.

Use an appropriate projected/equal-area CRS for area statistics.

Store:

```json
{
  "affected_area_m2": 0,
  "affected_area_km2": 0
}
```

with processing CRS metadata.

---

# 14. OSM Exposure Engine

## Inputs

```text
flood_polygons
OSM buildings
OSM roads
OSM bridges
```

## Operation

Spatial intersection.

### Buildings

```text
building ∩ flood_polygon != empty
```

→ estimated affected.

### Roads

Calculate:

```text
road ∩ flood_polygon
```

Then measure affected length.

### Bridges

Check:

- bridge point/geometry
- intersection with affected corridor
- crossing relationship.

Bridge interpretation should be conservative.

---

# 15. Road Graph

## Construction

```text
OSM road network
       ↓
graph G
       ↓
nodes = intersections/endpoints
edges = road segments
```

Each edge should carry:

```text
length
geometry
road type
affected status
```

---

# 16. Removing Damaged Roads

Baseline:

```text
affected edge → remove
```

Alternative:

```text
affected edge → extremely high cost
```

Use removal first because it is easier to explain.

Potential refinement:

Use partial intersection ratio:

```text
affected_ratio =
affected_length / total_edge_length
```

Then define a configurable threshold for treating the edge as blocked.

Do not claim that every one-pixel intersection physically destroys an
entire road.

---

# 17. Settlement Connectivity

For each settlement:

```text
settlement node
      ↓
nearest suitable road node
      ↓
hospital/town road node
      ↓
path exists?
```

Before/after comparison:

```text
connected_before = true
connected_after  = false
```

This is stronger than simply saying:

> "The village touches a flood."

The rescue consequence is the loss of connectivity.

---

# 18. Destination Selection

Potential destinations:

1.  hospitals
2.  district/major towns
3.  other configured service centers.

The initial MVP should use a deterministic rule.

Example:

```text
nearest hospital
```

If no hospital exists in OSM:

```text
nearest mapped town/service destination
```

The rule must be documented.

---

# 19. Verified Event JSON

Recommended schema:

```json
{
  "event": {
    "date": "2026-08-26",
    "bbox": []
  },

  "satellite": {
    "before_product": "",
    "after_product": "",
    "before_date": "",
    "after_date": "",
    "relative_orbit": "",
    "polarization": []
  },

  "flood": {
    "area_km2": 0,
    "polygon_file": "",
    "method": "",
    "threshold_method": "",
    "quality": ""
  },

  "exposure": {
    "buildings_estimated_affected": 0,
    "roads_affected_km": 0,
    "bridges_estimated_affected": 0
  },

  "connectivity": {
    "settlements_analyzed": 0,
    "settlements_cut_off": 0,
    "records": []
  },

  "limitations": []
}
```

The exact schema may evolve, but all consumers must use the documented
version.

---

# 20. AI Copilot Design

## Input

The LLM receives:

- verified result JSON
- user question
- reporting instructions.

Example:

```text
SYSTEM FACTS:
Affected buildings = 184
Affected road length = 7.2 km
Cut-off settlements = 3

USER:
Which villages are cut off?
```

The model may describe the facts.

It must not invent additional numbers.

---

# 21. AI Guardrail

If user asks:

> How many people are trapped?

and no population/trapped-person dataset exists:

```text
I cannot provide a verified number of trapped people because
the current analysis does not contain a validated population
or trapped-person estimate.
```

This is preferable to hallucination.

---

# 22. Report Generator

Report sections:

```text
1. Event Overview
2. Satellite Analysis
3. Infrastructure Impact
4. Road Connectivity
5. Priority Settlements
6. Limitations
7. Data Sources / Attribution
```

Keep it concise enough to fit one page.

---

# 23. Dashboard Architecture

## Main screen

```text
┌─────────────────────────────────────────┐
│ Mapping Flood Damage from Space         │
│ AOI | Date | Run Analysis               │
├──────────────────────┬──────────────────┤
│                      │ Summary          │
│                      │ Flood area       │
│        MAP           │ Buildings        │
│                      │ Roads            │
│                      │ Bridges          │
│                      │ Cut-off villages │
├──────────────────────┴──────────────────┤
│ AI Situation Copilot                    │
│ [Ask a question...]                     │
├─────────────────────────────────────────┤
│ Report / limitations / data metadata     │
└─────────────────────────────────────────┘
```

---

# 24. Repository Architecture

```text
track-b-flood-mapping/
│
├── README.md
├── PRD.md
├── Rules.md
├── Phases.md
├── Design.md
├── Memory.md
├── requirements.txt
├── .env.example
├── .gitignore
│
├── app/
│   ├── dashboard/
│   └── api/
│
├── pipeline/
│   ├── acquisition/
│   │   ├── sentinel1.py
│   │   ├── sentinel2.py
│   │   └── metadata.py
│   │
│   ├── preprocessing/
│   │   ├── sar.py
│   │   ├── alignment.py
│   │   └── terrain.py
│   │
│   ├── flood_detection/
│   │   ├── change_detection.py
│   │   ├── threshold.py
│   │   ├── filtering.py
│   │   └── polygonize.py
│   │
│   ├── exposure/
│   │   ├── osm.py
│   │   ├── buildings.py
│   │   ├── roads.py
│   │   └── bridges.py
│   │
│   ├── connectivity/
│   │   ├── graph.py
│   │   ├── destinations.py
│   │   └── cutoff.py
│   │
│   └── reporting/
│       ├── schema.py
│       ├── report.py
│       └── copilot.py
│
├── config/
├── data/
│   ├── raw/
│   ├── interim/
│   └── outputs/
│
├── tests/
├── scripts/
└── docs/
```

---

# 25. Error Handling

Potential errors:

### No imagery

Return:

```text
No suitable Sentinel-1 before/after pair found.
```

### Incompatible pair

Reject pair.

### CRS mismatch

Stop before spatial analysis.

### Invalid geometry

Repair/log.

### Missing OSM feature

Do not fabricate.

### No route

Distinguish:

- genuinely disconnected
- missing road data
- graph construction failure.

---

# 26. Performance Strategy

Start with small AOIs.

Avoid processing an entire country.

Pipeline should crop data to AOI as early as practical.

Cache:

- selected scenes
- downloaded products
- DEM
- OSM snapshot.

Avoid repeated downloads.

---

# 27. Configuration

Avoid magic constants.

Example:

```yaml
event:
  before_days: 20
  after_days: 20

sar:
  polarization: VV
  threshold_method: otsu

terrain:
  max_slope: configurable
  use_hand: false

roads:
  affected_ratio_threshold: configurable

processing:
  minimum_polygon_area_m2: configurable
```

Values are examples, not final scientifically validated constants.

---

# 28. Important Technical Decision

Do NOT commit to one exact implementation of every remote-sensing detail
before testing real scenes.

The following should be experimentally compared on the first test AOI:

- VV vs VH
- log-ratio formulation
- speckle filter strength
- Otsu vs alternative threshold
- slope threshold
- HAND threshold if implemented.

Record results in Memory.md.

---

# 29. Testing Architecture

Unit tests:

- geometry
- CRS
- threshold functions
- graph connectivity
- JSON schema.

Integration tests:

```text
AOI + date
    ↓
satellite pair
    ↓
flood result
    ↓
OSM
    ↓
connectivity
    ↓
report
```

Golden/smoke test:

One small known AOI with cached test data.

---

# 30. Design Principle

The final system should be explainable as:

> We compare compatible pre- and post-event radar observations, detect
> meaningful surface change, remove terrain-related false positives,
> overlay the resulting affected area on pre-event infrastructure data,
> and model the road network to identify settlements that lose mapped
> road connectivity. A grounded language model then communicates only
> the verified outputs.

That sentence should remain consistent across the README, report, demo,
and Q&A.
