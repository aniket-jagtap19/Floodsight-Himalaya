# PRD --- Mapping Flood Damage from Space

## Multimodal AI Hackathon 2026 --- Track B

**Status:** Implementation-ready planning document\
**Duration:** 15 days\
**Team size:** Up to 4\
**Case study:** August 2026 Trishuli flood, Nepal\
**Primary evaluation:** Live evaluation on areas and dates selected by
judges

---

## 1. Product Vision

Build an educational disaster-response prototype that takes:

- an Area of Interest (AOI)
- a flood/event date

and automatically produces:

1.  **Where did the flood hit?**
    - Detect flooded and debris-affected areas using Sentinel-1 radar
      and, when clear, Sentinel-2 optical imagery.
2.  **What was damaged?**
    - Overlay pre-event OpenStreetMap buildings, roads, and bridges.
    - Estimate which assets intersect the detected flood/debris area.
3.  **Who is cut off?**
    - Use the road network to identify settlements that no longer have
      a road connection to the nearest relevant town or hospital.

The system must also provide:

- a map dashboard
- a one-page situation report
- an AI component
- clear limitations
- reproducible case-study results for the August 2026 Trishuli flood.

The system is an **educational prototype**, not an operational
emergency-response system.

---

## 2. Problem Statement

When a flood/debris event destroys or blocks roads, bridges, and
communications, rescue teams need information about:

- the spatial extent of the event
- infrastructure likely affected
- settlements that have lost road connectivity.

Ground sensors can fail or disappear during disasters. Satellite data
provides regional coverage even when ground infrastructure is damaged.

The project converts raw satellite and map data into structured,
explainable rescue-oriented information.

---

## 3. Mandatory Inputs

### 3.1 Satellite data

Allowed:

- Sentinel-1
- Sentinel-2

Primary flood-detection source:

- Sentinel-1 SAR

Optional supporting source:

- Sentinel-2 optical imagery when sufficiently clear.

### 3.2 Elevation data

Allowed:

- Copernicus DEM

Used for:

- terrain correction
- terrain-aware filtering
- mountain/radar-shadow handling
- optional downstream/flood-path analysis.

### 3.3 Map data

Allowed:

- OpenStreetMap data representing the state of the map before the
  event.

The challenge specifies obtaining a pre-event snapshot through the
ohsome API.

### 3.4 Training datasets

Permitted listed datasets include:

- Kuro Siwo
- Sen1Floods11

Only use datasets according to their stated licensing/credit
requirements.

---

## 4. Forbidden Inputs

The following must NOT be used as system inputs:

- Copernicus EMS damage maps
- UNOSAT damage maps
- other published damage maps
- post-event OSM edits
- any external published damage product that effectively gives the
  answer.

These resources may only be used for checking/validation where
permitted.

**Critical rule:** the final system must be able to run end-to-end from
allowed raw/input data for an area/date selected by judges.

---

## 5. Core User Flow

```text
User enters:
    Area / bounding box
    Flood date

        ↓

System searches for satellite scenes

        ↓

Find suitable Sentinel-1 before/after pair

        ↓

Preprocess SAR

        ↓

Detect flood/debris-related change

        ↓

Apply terrain and quality filters

        ↓

Create flood/debris mask

        ↓

Convert result to geographic polygons

        ↓

Load pre-event OSM

        ↓

Estimate affected buildings/roads/bridges

        ↓

Build road graph

        ↓

Remove/penalize affected road segments

        ↓

Find settlements without road access
to nearest town/hospital

        ↓

Store verified results

        ↓

Dashboard + Situation Report + AI Copilot
```

---

## 6. Functional Requirements

### FR-01 --- AOI input

The user must be able to specify an area.

Supported initial representation:

- bounding box

Potential later enhancement:

- draw polygon on map.

The backend must work from the selected AOI rather than a hardcoded
Trishuli region.

### FR-02 --- Event date input

The user specifies the flood/event date.

The system searches for suitable imagery before and after that date.

### FR-03 --- Sentinel-1 acquisition

The system must search the Copernicus Data Space ecosystem for suitable
Sentinel-1 scenes.

Selection should prioritize:

1.  spatial coverage of AOI
2.  temporal proximity to event
3.  compatible acquisition mode
4.  compatible polarization
5.  same relative orbit/track
6.  acceptable quality/data coverage.

The exact search window should be configurable rather than hardcoded.

### FR-04 --- Before/after consistency

The system should avoid pixel-wise comparison of incompatible
acquisitions.

Priority:

- same orbit track
- same viewing geometry as closely as possible
- comparable processing
- comparable polarization
- suitable temporal spacing.

For the Trishuli case, the challenge specifically recommends same-track
imagery approximately 12 days apart.

### FR-05 --- SAR preprocessing

The pipeline must perform or obtain equivalent processing for:

- radiometric calibration/backscatter preparation
- noise handling
- speckle reduction where appropriate
- terrain correction/orthorectification
- geographic alignment
- nodata masking.

The implementation may use Copernicus-provided processed
products/services where they remain within the allowed
input/data-processing rules.

### FR-06 --- Flood/debris change detection

The baseline method should compare pre-event and post-event SAR
backscatter.

Conceptual change measure:

```text
change = log(after) - log(before)
```

or an equivalent ratio/log-ratio formulation.

The implementation should produce a candidate change mask.

### FR-07 --- Automatic thresholding

The baseline should support an automatic thresholding method such as
Otsu.

Threshold parameters must not be manually tuned specifically for the
Trishuli validation scene if the same pipeline is expected to work on
judge-selected scenes.

### FR-08 --- Terrain-aware filtering

Use DEM-derived information to reduce false positives caused by:

- radar shadow
- layover
- steep terrain
- implausible high-elevation flood detections.

Potential terrain features:

- slope
- elevation
- local incidence/quality masks when available
- HAND or another drainage-relative metric.

HAND is a recommended analytical enhancement, not an absolute mandatory
requirement.

### FR-09 --- Flood/debris output

Output must contain:

- flood/debris raster mask
- geographic flood/debris polygons
- area statistics
- processing metadata
- quality/confidence indicators where possible.

The system must distinguish clearly between:

- detected/estimated flood area
- uncertain/debris-affected change.

Do not claim exact water depth or exact structural collapse.

### FR-10 --- OSM exposure mapping

Retrieve pre-event OSM data.

Relevant feature categories:

- buildings
- roads
- bridges
- settlements
- hospitals/towns where available.

Perform spatial intersection/overlay with the event polygons.

### FR-11 --- Asset impact estimation

For each asset type, calculate useful metrics.

Examples:

**Buildings** - number intersecting event area - optional affected area
percentage.

**Roads** - affected length - percentage of road segment affected -
affected segment geometry.

**Bridges** - bridge point/geometry intersecting or crossing affected
corridor.

The wording must be:

- estimated affected
- likely hit
- intersecting detected flood/debris area

rather than:

- destroyed
- collapsed

unless independent evidence exists, which the system is not allowed to
use as an input.

### FR-12 --- Road-network analysis

Convert the road network into a graph:

```text
intersection = node
road segment = edge
```

Affected road segments should be removed or assigned an
unusable/high-cost state according to the chosen implementation.

### FR-13 --- Cut-off settlement analysis

For each selected settlement:

1.  identify the nearest relevant town/hospital destination
2.  check road connectivity
3.  calculate whether a valid road path remains
4.  report the settlement as road-isolated if no valid path exists.

Potential algorithms:

- connected components
- BFS/DFS
- shortest path
- Dijkstra/A\* where weighted routing is useful.

NetworkX is suitable for the graph layer.

### FR-14 --- AI Situation-Report Copilot

Recommended AI option:

**Situation-report copilot**

The copilot must:

- answer rescuer questions
- summarize verified results
- generate a short situation report
- support English
- support Nepali where feasible.

The LLM must NOT independently calculate or invent statistics.

### FR-15 --- Numerical grounding

Every numerical statement generated by the AI must come from verified
structured system results.

Example:

```text
BAD:
"The flood affected approximately 1,200 buildings."
```

if that number was invented by the LLM.

Correct architecture:

```text
Geospatial engine
    ↓
affected_buildings = 1,184
    ↓
verified JSON
    ↓
LLM
    ↓
"The analysis estimates 1,184 buildings
intersecting the detected affected area."
```

### FR-16 --- Dashboard

Dashboard should show:

- AOI
- event date
- before image
- after image
- flood/debris layer
- OSM infrastructure
- affected assets
- road network
- cut-off settlements
- hospital/town destinations
- summary statistics
- limitations/data quality.

### FR-17 --- One-page report

Generate a concise report containing:

- event/date
- analyzed area
- flood/debris estimate
- affected infrastructure
- cut-off settlements
- key limitations
- data sources/attributions.

---

## 7. AI Architecture

Recommended architecture:

```text
                ┌───────────────────────┐
                │ Deterministic Engine  │
                │ satellite + GIS +     │
                │ graph analysis        │
                └──────────┬────────────┘
                           │
                     verified JSON
                           │
                           ▼
                ┌───────────────────────┐
                │ AI Situation Copilot  │
                │ writer / translator   │
                │ / question answering  │
                └──────────┬────────────┘
                           │
                           ▼
                  Human-readable report
```

The deterministic geospatial engine is the **source of truth**.

The LLM is the:

- writer
- translator
- question-answering interface.

---

## 8. Non-Functional Requirements

### NFR-01 --- Generalization

No hardcoded:

- Trishuli coordinates
- fixed flood polygons
- fixed village names
- fixed damage counts
- manually selected judge answer.

### NFR-02 --- Reproducibility

The same:

```text
AOI + event date + configuration
```

should produce reproducible outputs subject to upstream data/version
changes.

### NFR-03 --- Explainability

Every major result should have an explanation path:

```text
Satellite change
→ flood polygon
→ intersected road
→ removed road edge
→ disconnected settlement
```

### NFR-04 --- Logging

Log:

- input AOI
- event date
- selected scenes
- orbit information
- preprocessing choices
- thresholds
- data timestamps
- processing warnings
- output statistics.

### NFR-05 --- Graceful failure

If no suitable imagery exists:

- do not fabricate a result
- explain the failure
- show available candidate dates if possible.

---

## 9. Accuracy and Evaluation

Possible flood-map metrics:

- Precision
- Recall
- IoU

The official EMSR927 product is for checking/validation, not for
generating the result.

The report should honestly discuss disagreements.

---

## 10. Case Study

Primary demonstration:

**August 2026 Trishuli flood, Nepal**

The system should produce:

- flood/debris map
- affected infrastructure
- cut-off settlements
- dashboard
- situation report.

Results may be compared against EMSR927 only for validation.

---

## 11. Bonus Feature

Optional:

Given an upstream point:

```text
upstream point
    ↓
DEM / drainage / terrain
    ↓
downstream corridor
    ↓
candidate flood path
    ↓
settlements along path
```

This should only be attempted after the core pipeline is reliable.

---

## 12. Explicit Limitations

The system must state:

- Sentinel revisit time is measured in days, so this is not a
  minute-by-minute early-warning system.
- SAR can have shadow/layover and other terrain-related errors.
- Smooth surfaces and some non-water changes can resemble flood
  signatures.
- Sentinel resolution limits exact building-level damage claims.
- OSM may be incomplete or outdated.
- Road cut-off means loss of mapped road connectivity, not total
  physical isolation.
- Remote Himalayan terrain creates difficult radar geometry.
- Debris and standing water are not always perfectly separable.
- Results depend on satellite availability and image quality.
- This is an educational prototype, not an operational rescue system.

---

## 13. Success Criteria

A successful MVP should:

- accept AOI + date
- automatically find suitable Sentinel-1 imagery
- produce a plausible flood/change map
- overlay pre-event OSM
- estimate affected assets
- calculate road-based cut-off settlements
- generate grounded report text
- work on more than one test area
- run without manually drawing the answer
- document limitations.

---

## 14. Submission Requirements

Prepare:

- GitHub repository
- README with run instructions
- report maximum 6 pages
- 3-minute demo video
- required data attributions
- training dataset citations
- case-study comparison with EMSR927.

---

## 15. Required Attribution

Include the challenge-required attribution text:

> Contains modified Copernicus Sentinel data 2026.

> Produced using Copernicus WorldDEM-30 © DLR e.V. 2010--2014 and ©
> Airbus Defence and Space GmbH 2014--2018 provided under COPERNICUS by
> the European Union and ESA; all rights reserved.

> © OpenStreetMap contributors.

Also cite every training dataset actually used.
