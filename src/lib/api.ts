import { apiFetch, ApiError, getBaseUrl } from "./http";
import {
  CopilotAnswerSchema,
  RecentRunSchema,
  ReportDataSchema,
  RunResultSchema,
  RunStatusSchema,
} from "./schemas";
import type { CopilotAnswer, Lang, PipelineStep, RecentRun, RunResult } from "./types";
import {
  getMockPipelineSteps,
  getMockRecentRuns,
  getMockReport,
  getMockRunResult,
  askMockCopilot,
  startMockAnalysis,
} from "./api.mock";

export const isMockMode = () => getBaseUrl() === "";

let currentActiveRunId = "run-2026-0826-trishuli";

export function getActiveRunId(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("fs-active-run-id");
    if (stored) return stored;
  }
  return currentActiveRunId;
}

export function setActiveRunId(runId: string): void {
  currentActiveRunId = runId;
  if (typeof window !== "undefined") {
    localStorage.setItem("fs-active-run-id", runId);
  }
}

export interface AnalysisRequest {
  bbox: [number, number, number, number];
  floodDate: string;
  osmDate: string;
  useOptical: boolean;
}

export interface RunStatusStep {
  id: number | string;
  label: string;
  log: string;
  state: "pending" | "running" | "done" | "warning" | "failed" | "not_implemented";
  warning?: string;
  durationMs?: number;
}

export interface RunStatus {
  runId: string;
  state: "queued" | "running" | "succeeded" | "failed" | "failed_not_implemented";
  steps: RunStatusStep[];
  error?: string;
}

export interface ReportData {
  lang: Lang;
  generatedAt: string;
  run: RunResult;
  priority: RunResult["villages"];
}

function calculateAreaKm2(b: [number, number, number, number]) {
  const lat = ((b[1] + b[3]) / 2) * (Math.PI / 180);
  return Math.abs((b[2] - b[0]) * 111.32 * Math.cos(lat) * (b[3] - b[1]) * 110.57);
}

export async function getRunResult(runId?: string): Promise<RunResult> {
  const targetRunId = runId || getActiveRunId();
  if (isMockMode()) {
    return getMockRunResult(targetRunId);
  }
  const result = await apiFetch(
    `/api/runs/${encodeURIComponent(targetRunId)}/result`,
    {},
    RunResultSchema,
  );
  return result as RunResult;
}

export async function getRecentRuns(): Promise<RecentRun[]> {
  if (isMockMode()) {
    return getMockRecentRuns();
  }
  return apiFetch("/api/runs", {}, RecentRunSchema.array());
}

export async function getRunStatus(runId: string): Promise<RunStatus> {
  if (isMockMode()) {
    const steps = await getMockPipelineSteps();
    const formattedSteps: RunStatusStep[] = steps.map((s) => {
      const step: RunStatusStep = {
        id: s.id,
        label: s.label,
        log: s.log,
        state: "done",
        durationMs: s.durationMs,
      };
      if (s.warning !== undefined) {
        step.warning = s.warning;
      }
      return step;
    });

    return {
      runId,
      state: "succeeded",
      steps: formattedSteps,
    };
  }

  const rawStatus = await apiFetch(
    `/api/runs/${encodeURIComponent(runId)}/status`,
    {},
    RunStatusSchema,
  );
  const steps: RunStatusStep[] = rawStatus.steps.map((s) => {
    const step: RunStatusStep = {
      id: s.id,
      label: s.label,
      log: s.log,
      state: s.state,
    };
    if (s.warning !== undefined) step.warning = s.warning;
    if (s.durationMs !== undefined) step.durationMs = s.durationMs;
    return step;
  });

  const resStatus: RunStatus = {
    runId: rawStatus.runId,
    state: rawStatus.state,
    steps,
  };
  if (rawStatus.error !== undefined) {
    resStatus.error = rawStatus.error;
  }
  return resStatus;
}

export async function getPipelineSteps(runId?: string): Promise<PipelineStep[]> {
  if (isMockMode()) {
    return getMockPipelineSteps();
  }
  const targetRunId = runId || getActiveRunId();
  const status = await getRunStatus(targetRunId);
  return status.steps.map((s, idx) => {
    const step: PipelineStep = {
      id: typeof s.id === "number" ? s.id : idx + 1,
      label: s.label,
      log: s.log,
      durationMs: s.durationMs ?? 0,
    };
    if (s.warning !== undefined) {
      step.warning = s.warning;
    }
    return step;
  });
}

export async function startAnalysis(
  req: AnalysisRequest,
): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  if (req.bbox[0] >= req.bbox[2] || req.bbox[1] >= req.bbox[3]) {
    return {
      ok: false,
      error:
        "Invalid bounding box coordinates. West coordinate must be less than East, and South less than North.",
    };
  }
  const area = calculateAreaKm2(req.bbox);
  if (area > 5000) {
    return {
      ok: false,
      error: `Selected area (${area.toFixed(0)} km²) exceeds the maximum limit of 5000 km².`,
    };
  }
  if (req.osmDate >= req.floodDate) {
    return { ok: false, error: "The OSM snapshot must be dated before the flood event." };
  }

  if (isMockMode()) {
    const res = await startMockAnalysis(req);
    if (res.ok) {
      setActiveRunId(res.runId);
    }
    return res;
  }

  try {
    const res = await apiFetch<{ runId: string }>(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify(req),
      },
      undefined,
    );
    if (res.runId) {
      setActiveRunId(res.runId);
    }
    return { ok: true, runId: res.runId };
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Failed to start analysis." };
  }
}

export async function askCopilot(
  question: string,
  lang: Lang,
  runId?: string,
): Promise<CopilotAnswer> {
  const targetRunId = runId || getActiveRunId();
  if (isMockMode()) {
    return askMockCopilot(question, lang);
  }
  const res = await apiFetch(
    `/api/runs/${encodeURIComponent(targetRunId)}/ask`,
    {
      method: "POST",
      body: JSON.stringify({ question, lang }),
    },
    CopilotAnswerSchema,
  );
  return res as CopilotAnswer;
}

export async function getReport(lang: Lang, runId?: string): Promise<ReportData> {
  const targetRunId = runId || getActiveRunId();
  if (isMockMode()) {
    return getMockReport(lang);
  }
  const res = await apiFetch(
    `/api/runs/${encodeURIComponent(targetRunId)}/report?lang=${encodeURIComponent(lang)}`,
    {},
    ReportDataSchema,
  );
  return res as ReportData;
}

/** Call the AI report endpoint (live mode only). Returns CopilotAnswer. */
export async function getLiveReport(lang: Lang, runId?: string): Promise<CopilotAnswer> {
  const targetRunId = runId || getActiveRunId();
  const res = await apiFetch(
    `/api/runs/${encodeURIComponent(targetRunId)}/report?lang=${encodeURIComponent(lang)}`,
    {},
    CopilotAnswerSchema,
  );
  return res as CopilotAnswer;
}
