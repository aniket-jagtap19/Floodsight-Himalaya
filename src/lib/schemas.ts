import { z } from "zod";
import type * as T from "./types";

export const LngLatSchema = z.tuple([z.number(), z.number()]);
export const LatLngSchema = z.tuple([z.number(), z.number()]);
export const RingSchema = z.array(LngLatSchema);

export const StatusSchema = z.enum(["likely_hit", "not_hit"]);

export const SceneSchema = z.object({
  id: z.string(),
  sensor: z.string(),
  role: z.enum(["before", "after", "event", "optical"]),
  date: z.string(),
  orbit: z.string(),
  cloudCover: z.number().nullable(),
});

export const AreaPolygonSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  confidence: z.number().optional(),
  coordinates: z.array(RingSchema),
});

export const BuildingSchema = z.object({
  id: z.string(),
  osmId: z.string(),
  name: z.string(),
  category: z.string(),
  lat: z.number(),
  lon: z.number(),
  status: StatusSchema,
  confidence: z.number().nullable(),
  reason: z.string().nullable(),
  village: z.string(),
  distanceToRiverM: z.number().nullable(),
});

export const RoadSchema = z.object({
  id: z.string(),
  osmId: z.string(),
  name: z.string(),
  roadClass: z.enum(["primary", "secondary", "tertiary", "track"]),
  lengthKm: z.number(),
  status: z.enum(["flooded", "intact"]),
  confidence: z.number().nullable(),
  reason: z.string().nullable(),
  coordinates: z.array(LngLatSchema),
});

export const BridgeSchema = z.object({
  id: z.string(),
  osmId: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  status: z.enum(["damaged", "intact"]),
  confidence: z.number().nullable(),
  reason: z.string().nullable(),
});

export const VillageSchema = z.object({
  id: z.string(),
  osmId: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  status: z.enum(["cut_off", "connected"]),
  population: z.number().nullable(),
  nearestHospitalId: z.string(),
  distanceBeforeKm: z.number(),
  distanceAfterKm: z.number().nullable(),
  reason: z.string().nullable(),
  alternateRoute: z.string(),
  priority: z.number().nullable(),
  confidence: z.number().nullable(),
  route: z.object({
    coordinates: z.array(LatLngSchema),
    brokenSegmentIds: z.array(z.string()),
    breakPoints: z.array(LatLngSchema),
  }),
});

export const FacilitySchema = z.object({
  id: z.string(),
  osmId: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  kind: z.enum(["hospital", "town"]),
});

export const KpisSchema = z.object({
  floodedAreaKm2: z.number(),
  debrisAreaKm2: z.number(),
  buildingsLikelyHit: z.number(),
  buildingsTotal: z.number(),
  roadLengthAffectedKm: z.number(),
  bridgesLikelyDamaged: z.number(),
  bridgesTotal: z.number(),
  villagesCutOff: z.number(),
  villagesTotal: z.number(),
  peopleInCutOffVillages: z.number().nullable(),
});

export const ValidationRegionSchema = z.object({
  name: z.string(),
  date: z.string(),
  orbit: z.string(),
  cloudCover: z.string(),
  precision: z.number(),
  recall: z.number(),
  f1: z.number(),
  iou: z.number(),
});

export const ValidationSchema = z.object({
  reference: z.string(),
  precision: z.number(),
  recall: z.number(),
  f1: z.number(),
  iou: z.number(),
  areaOursKm2: z.number(),
  areaRefKm2: z.number(),
  tpKm2: z.number(),
  fpKm2: z.number(),
  fnKm2: z.number(),
  regions: z.array(ValidationRegionSchema),
  referencePolygons: z.array(AreaPolygonSchema),
});

export const RunResultSchema = z.object({
  runId: z.string(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  areaName: z.string(),
  eventDate: z.string(),
  osmSnapshotDate: z.string(),
  scenes: z.array(SceneSchema),
  floodPolygons: z.array(AreaPolygonSchema),
  debrisPolygons: z.array(AreaPolygonSchema),
  confidence: z.object({
    lowConfidencePolygons: z.array(AreaPolygonSchema),
    meanConfidence: z.number(),
  }),
  radarShadowPolygons: z.array(AreaPolygonSchema),
  flowPath: z.object({
    upstream: LatLngSchema,
    coordinates: z.array(LatLngSchema),
    labels: z.array(z.string()),
  }),
  buildings: z.array(BuildingSchema),
  roads: z.array(RoadSchema),
  bridges: z.array(BridgeSchema),
  villages: z.array(VillageSchema),
  hospitals: z.array(FacilitySchema),
  towns: z.array(FacilitySchema),
  kpis: KpisSchema,
  validation: ValidationSchema.nullable(),
  provenance: z.object({
    scenes: z.enum(["mock", "live", "not_run"]),
    flood: z.enum(["mock", "live", "not_run"]),
    exposure: z.enum(["mock", "live", "not_run"]),
    connectivity: z.enum(["mock", "live", "not_run"]),
    validation: z.enum(["mock", "live", "not_run"]),
    copilot: z.enum(["mock", "live", "not_run"]),
  }),
  quality: z.object({
    sentinel1PairQuality: z.string().nullable(),
    notes: z.array(z.string()),
  }),
  limitations: z.array(z.string()),
  metadata: z.object({
    generatedAt: z.string(),
    pipelineVersion: z.string(),
    model: z.string().nullable(),
    resolutionM: z.number(),
    dataMode: z.enum(["mock", "live", "mixed"]),
  }),
});

export const RecentRunSchema = z.object({
  runId: z.string(),
  areaName: z.string(),
  eventDate: z.string(),
  floodedKm2: z.number(),
  cutOff: z.number(),
});

export const NumberSourceSchema = z.object({
  layer: z.string(),
  query: z.string(),
  value: z.string(),
  runId: z.string(),
});

export const CopilotAnswerSchema = z.object({
  available: z.boolean(),
  markdown: z.string(),
  sources: z.record(
    z.object({
      display: z.string(),
      layer: z.string(),
      query: z.string(),
      value: z.string(),
      runId: z.string(),
    }),
  ),
  tools: z.array(z.string()),
  table: z
    .object({
      columns: z.array(z.string()),
      rows: z.array(z.array(z.union([z.string(), z.number()]))),
    })
    .optional(),
  miniMap: z
    .object({
      villageIds: z.array(z.string()),
    })
    .optional(),
  /** Non-null for Nepali answers: machine-generated disclaimer */
  note: z.string().optional(),
});

export const PipelineStepSchema = z.object({
  id: z.number(),
  label: z.string(),
  log: z.string(),
  durationMs: z.number(),
  warning: z.string().optional(),
  mock: z.boolean().optional(),
});

export const RunStatusStepSchema = z.object({
  id: z.union([z.number(), z.string()]),
  label: z.string(),
  log: z.string(),
  state: z.enum(["pending", "running", "done", "warning", "failed", "not_implemented"]),
  warning: z.string().optional(),
  durationMs: z.number().optional(),
});

export const RunStatusSchema = z.object({
  runId: z.string(),
  state: z.enum(["queued", "running", "succeeded", "failed", "failed_not_implemented"]),
  steps: z.array(RunStatusStepSchema),
  error: z.string().optional(),
});

export const ReportDataSchema = z.object({
  lang: z.enum(["en", "ne"]),
  generatedAt: z.string(),
  run: RunResultSchema,
  priority: z.array(VillageSchema),
});

// Inferred Types
export type SceneSchemaType = z.infer<typeof SceneSchema>;
export type AreaPolygonSchemaType = z.infer<typeof AreaPolygonSchema>;
export type BuildingSchemaType = z.infer<typeof BuildingSchema>;
export type RoadSchemaType = z.infer<typeof RoadSchema>;
export type BridgeSchemaType = z.infer<typeof BridgeSchema>;
export type VillageSchemaType = z.infer<typeof VillageSchema>;
export type FacilitySchemaType = z.infer<typeof FacilitySchema>;
export type KpisSchemaType = z.infer<typeof KpisSchema>;
export type ValidationSchemaType = z.infer<typeof ValidationSchema>;
export type RunResultSchemaType = z.infer<typeof RunResultSchema>;
export type RecentRunSchemaType = z.infer<typeof RecentRunSchema>;
export type CopilotAnswerSchemaType = z.infer<typeof CopilotAnswerSchema>;
export type PipelineStepSchemaType = z.infer<typeof PipelineStepSchema>;
export type RunStatusStepSchemaType = z.infer<typeof RunStatusStepSchema>;
export type RunStatusSchemaType = z.infer<typeof RunStatusSchema>;
export type ReportDataSchemaType = z.infer<typeof ReportDataSchema>;

// Compile-Time Assertions
type AssertExtends<TInferred, TTarget> = TInferred extends TTarget ? true : false;
type AssertAssignable<TTarget, TInferred> = TTarget extends TInferred ? true : false;

export type _AssertRunResult = AssertExtends<RunResultSchemaType, T.RunResult> &
  AssertAssignable<T.RunResult, RunResultSchemaType>;
export type _AssertRecentRun = AssertExtends<RecentRunSchemaType, T.RecentRun> &
  AssertAssignable<T.RecentRun, RecentRunSchemaType>;
export type _AssertCopilotAnswer = AssertExtends<CopilotAnswerSchemaType, T.CopilotAnswer> &
  AssertAssignable<T.CopilotAnswer, CopilotAnswerSchemaType>;
export type _AssertPipelineStep = AssertExtends<PipelineStepSchemaType, T.PipelineStep> &
  AssertAssignable<T.PipelineStep, PipelineStepSchemaType>;
