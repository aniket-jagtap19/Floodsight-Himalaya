/**
 * Coordinate Order Conventions:
 * NOTE: The contract deliberately mixes coordinate order depending on context:
 * - Ring and Road.coordinates are GeoJSON standard [lng, lat].
 * - Village.route.coordinates, breakPoints, and flowPath are Leaflet standard [lat, lng].
 */
export type LngLat = [number, number];
export type LatLng = [number, number];
export type Ring = LngLat[];

export type Status = "likely_hit" | "not_hit";

export interface Scene {
  id: string;
  sensor: string;
  role: "before" | "after" | "event" | "optical";
  date: string;
  orbit: string;
  cloudCover: number | null;
}

export interface AreaPolygon {
  id: string;
  type?: string;
  confidence?: number;
  coordinates: Ring[];
}

export interface Building {
  id: string;
  osmId: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  status: Status;
  confidence: number | null;
  reason: string | null;
  village: string;
  distanceToRiverM: number | null;
}

export interface Road {
  id: string;
  osmId: string;
  name: string;
  roadClass: "primary" | "secondary" | "tertiary" | "track";
  lengthKm: number;
  status: "flooded" | "intact";
  confidence: number | null;
  reason: string | null;
  coordinates: LngLat[];
}

export interface Bridge {
  id: string;
  osmId: string;
  name: string;
  lat: number;
  lon: number;
  status: "damaged" | "intact";
  confidence: number | null;
  reason: string | null;
}

export interface Village {
  id: string;
  osmId: string;
  name: string;
  lat: number;
  lon: number;
  status: "cut_off" | "connected";
  population: number | null;
  nearestHospitalId: string;
  distanceBeforeKm: number;
  distanceAfterKm: number | null;
  reason: string | null;
  alternateRoute: string;
  priority: number | null;
  confidence: number | null;
  route: { coordinates: LatLng[]; brokenSegmentIds: string[]; breakPoints: LatLng[] };
}

export interface Facility {
  id: string;
  osmId: string;
  name: string;
  lat: number;
  lon: number;
  kind: "hospital" | "town";
}

export interface Kpis {
  floodedAreaKm2: number;
  debrisAreaKm2: number;
  buildingsLikelyHit: number;
  buildingsTotal: number;
  roadLengthAffectedKm: number;
  bridgesLikelyDamaged: number;
  bridgesTotal: number;
  villagesCutOff: number;
  villagesTotal: number;
  peopleInCutOffVillages: number | null;
}

export interface ValidationRegion {
  name: string;
  date: string;
  orbit: string;
  cloudCover: string;
  precision: number;
  recall: number;
  f1: number;
  iou: number;
}

export interface Validation {
  reference: string;
  precision: number;
  recall: number;
  f1: number;
  iou: number;
  areaOursKm2: number;
  areaRefKm2: number;
  tpKm2: number;
  fpKm2: number;
  fnKm2: number;
  regions: ValidationRegion[];
  referencePolygons: AreaPolygon[];
}

export interface RunResult {
  runId: string;
  bbox: [number, number, number, number]; // [west, south, east, north]
  areaName: string;
  eventDate: string;
  osmSnapshotDate: string;
  scenes: Scene[];
  floodPolygons: AreaPolygon[];
  debrisPolygons: AreaPolygon[];
  confidence: { lowConfidencePolygons: AreaPolygon[]; meanConfidence: number };
  radarShadowPolygons: AreaPolygon[];
  flowPath: { upstream: LatLng; coordinates: LatLng[]; labels: string[] };
  buildings: Building[];
  roads: Road[];
  bridges: Bridge[];
  villages: Village[];
  hospitals: Facility[];
  towns: Facility[];
  kpis: Kpis;
  validation: Validation | null;
  provenance: Record<
    "scenes" | "flood" | "exposure" | "connectivity" | "validation" | "copilot",
    "mock" | "live" | "not_run"
  >;
  quality: { sentinel1PairQuality: string | null; notes: string[] };
  limitations: string[];
  metadata: {
    generatedAt: string;
    pipelineVersion: string;
    model: string | null;
    resolutionM: number;
    dataMode: "mock" | "live" | "mixed";
  };
}

export interface RecentRun {
  runId: string;
  areaName: string;
  eventDate: string;
  floodedKm2: number;
  cutOff: number;
}

export type Lang = "en" | "ne";

export interface NumberSource {
  layer: string;
  query: string;
  value: string;
  runId: string;
}

export interface CopilotAnswer {
  available: boolean;
  markdown: string; // numbers referenced as `#key`
  sources: Record<string, { display: string } & NumberSource>;
  tools: string[];
  table?: { columns: string[]; rows: (string | number)[][] };
  miniMap?: { villageIds: string[] };
  /** Non-null for Nepali answers: "Nepali text is machine-generated; verify before use." */
  note?: string;
}

export interface PipelineStep {
  id: number;
  label: string;
  log: string;
  durationMs: number;
  warning?: string;
  mock?: boolean;
}

export type StepStatus = "pending" | "running" | "done" | "warning" | "failed" | "not_implemented";
export type RunState = "queued" | "running" | "succeeded" | "failed" | "failed_not_implemented";

export interface RunStatusStep {
  id: number | string;
  label: string;
  log: string;
  state: StepStatus;
  warning?: string;
  durationMs?: number;
}

export interface RunStatus {
  runId: string;
  state: RunState;
  steps: RunStatusStep[];
  error?: string;
}
