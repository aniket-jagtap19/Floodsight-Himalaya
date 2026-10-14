import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronDown,
  Info,
  MapPin,
  Play,
  RefreshCw,
  Square,
  Satellite,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BboxMap } from "@/components/map";
import { PipelineStepper, type StepState } from "@/components/PipelineStepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getPipelineSteps, isMockMode, startAnalysis } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { fmtDate, recentRunsQuery, useRunStatus } from "@/lib/queries";
import type { PipelineStep } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "New analysis — FloodSight Himalaya" },
      {
        name: "description",
        content:
          "Pick an area and flood date to map flood extent, damage and cut-off villages from satellite radar.",
      },
      { property: "og:title", content: "New analysis — FloodSight Himalaya" },
      {
        property: "og:description",
        content: "Pick an area and flood date to map flood extent, damage and cut-off villages.",
      },
    ],
  }),
  component: NewAnalysis,
});

const PRESET: [number, number, number, number] = [85.12, 27.9, 85.42, 28.3];

function areaKm2(b: [number, number, number, number]) {
  const lat = ((b[1] + b[3]) / 2) * (Math.PI / 180);
  return Math.abs((b[2] - b[0]) * 111.32 * Math.cos(lat) * (b[3] - b[1]) * 110.57);
}

function NewAnalysis() {
  const { theme, setActiveRunId } = useApp();
  const nav = useNavigate();
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(PRESET);
  const [drawing, setDrawing] = useState(false);
  const [floodDate, setFloodDate] = useState("2026-08-26");
  const [osmDate, setOsmDate] = useState("2026-07-27");
  const [optical, setOptical] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock mode state
  const [steps, setSteps] = useState<PipelineStep[] | null>(null);
  const [states, setStates] = useState<StepState[]>([]);
  const [elapsed, setElapsed] = useState<number[]>([]);
  const timers = useRef<number[]>([]);

  // Live mode state
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  // Pre-populated immediately on run start so the stepper is never blank during
  // the first 1500 ms polling gap. Replaced by real data once statusData arrives.
  const [livePlaceholderSteps, setLivePlaceholderSteps] = useState<PipelineStep[]>([]);
  const { data: statusData } = useRunStatus(isMockMode() ? null : liveRunId);

  const { data: recent, isLoading } = useQuery(recentRunsQuery);

  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      currentTimers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!isMockMode() && statusData && statusData.state === "succeeded") {
      const timeout = setTimeout(() => {
        if (liveRunId) setActiveRunId(liveRunId);
        nav({ to: "/dashboard" });
      }, 800);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [statusData, liveRunId, nav, setActiveRunId]);

  async function run() {
    setError(null);
    if (!bbox) return setError("Draw an area or pick the preset first.");

    const res = await startAnalysis({ bbox, floodDate, osmDate, useOptical: optical });
    if (!res.ok) {
      return setError(res.error);
    }

    setActiveRunId(res.runId);

    if (isMockMode()) {
      const s = await getPipelineSteps();
      setSteps(s);
      setStates(s.map(() => "pending"));
      setElapsed(s.map(() => 0));
      let t = 0;
      s.forEach((step, i) => {
        timers.current.push(
          window.setTimeout(() => setStates((p) => p.map((x, j) => (j === i ? "running" : x))), t),
        );
        t += step.durationMs;
        const end = t;
        timers.current.push(
          window.setTimeout(() => {
            setStates((p) => p.map((x, j) => (j === i ? (step.warning ? "warning" : "done") : x)));
            setElapsed((p) => p.map((x, j) => (j === i ? step.durationMs : x)));
          }, end),
        );
      });
      timers.current.push(window.setTimeout(() => nav({ to: "/dashboard" }), t + 700));
    } else {
      setLiveRunId(res.runId);
      // Pre-seed placeholder pending steps immediately so the stepper renders
      // before the first poll fires (avoids a blank 1500 ms gap).
      getPipelineSteps()
        .then((s) => {
          setLivePlaceholderSteps(s.map((step) => ({ ...step, log: "Queued\u2026" })));
        })
        .catch(() => {
          /* no-op: stepper will fill in on first poll */
        });
    }
  }

  const resetAnalysis = () => {
    setSteps(null);
    setLiveRunId(null);
    setLivePlaceholderSteps([]);
    setError(null);
  };

  const isLiveRunning = !isMockMode() && Boolean(liveRunId);
  const isMockRunning = isMockMode() && steps !== null;
  const running = isLiveRunning || isMockRunning;

  // Derive steps for live mode with exact optional types.
  // Fall back to placeholder pending steps until the first poll returns.
  const liveSteps: PipelineStep[] =
    statusData?.steps.map((s, idx) => {
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
    }) ?? livePlaceholderSteps;

  const liveStates: StepState[] =
    statusData?.steps.map((s) => s.state) ?? livePlaceholderSteps.map(() => "pending" as StepState);
  const liveElapsed: number[] =
    statusData?.steps.map((s) => s.durationMs ?? 0) ?? livePlaceholderSteps.map(() => 0);

  const failingStep = statusData?.steps.find((s) => s.state === "failed");
  const notImplementedStep = statusData?.steps.find((s) => s.state === "not_implemented");
  const isFailedNotImplemented = statusData?.state === "failed_not_implemented";
  const isMalformedError = error?.includes("Backend returned malformed data:");

  return (
    <div className="mx-auto max-w-[1500px] p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">New analysis</h1>
        <p className="text-sm text-muted-foreground">
          Choose an area and the flood date. The system compares radar images from before and after.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <Button
              size="sm"
              variant={drawing ? "default" : "outline"}
              onClick={() => setDrawing((d) => !d)}
            >
              <Square className="size-3.5" /> {drawing ? "Drag on map…" : "Draw rectangle"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBbox(PRESET);
                setDrawing(false);
              }}
            >
              <MapPin className="size-3.5" /> Trishuli–Bhote Koshi corridor, Nepal
            </Button>
            {bbox && (
              <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                <span className="num">
                  W {bbox[0].toFixed(3)} · S {bbox[1].toFixed(3)} · E {bbox[2].toFixed(3)} · N{" "}
                  {bbox[3].toFixed(3)}
                </span>
                <span className="num rounded-md bg-secondary px-2 py-0.5 text-foreground">
                  {areaKm2(bbox).toFixed(0)} km²
                </span>
              </div>
            )}
          </div>
          <div className="h-[520px]">
            <BboxMap
              bbox={bbox}
              drawing={drawing}
              dark={theme === "dark"}
              onBox={(b) => {
                setBbox(b);
                setDrawing(false);
              }}
            />
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          {!running ? (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="fd">Flood date</Label>
                <Input
                  id="fd"
                  type="date"
                  value={floodDate}
                  onChange={(e) => setFloodDate(e.target.value)}
                  className="num"
                />
              </div>
              <div className="rounded-lg border bg-surface p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Satellite className="size-4 text-muted-foreground" /> Radar image pair
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border bg-card p-2">
                    <div className="text-muted-foreground">Before</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      Selected automatically from available same-orbit scenes
                    </div>
                  </div>
                  <div className="rounded-md border bg-card p-2">
                    <div className="text-muted-foreground">After</div>
                    <div className="num mt-1 font-medium">S1A · {floodDate}</div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Sentinel-1, same orbit track, ~12 days apart.
                </p>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label htmlFor="opt">Add Sentinel-2 optical</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Use optical if cloud cover is low.
                  </p>
                </div>
                <Switch id="opt" checked={optical} onCheckedChange={setOptical} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="osm">Pre-event OSM snapshot</Label>
                <Input
                  id="osm"
                  type="date"
                  value={osmDate}
                  onChange={(e) => setOsmDate(e.target.value)}
                  className="num"
                />
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Info className="size-3" /> Must be before the event, so buildings and roads show
                  what existed.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">{error}</p>
                      {isMalformedError && (
                        <Collapsible className="mt-2">
                          <CollapsibleTrigger className="flex items-center gap-1 font-normal text-xs underline">
                            Technical details <ChevronDown className="size-3" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-1.5 rounded bg-background/80 p-2 font-mono text-xs text-foreground">
                            {error}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Button id="run-analysis-button" className="w-full" size="lg" onClick={run}>
                <Play className="size-4" /> Run analysis
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">
                {isFailedNotImplemented
                  ? "Pipeline Stage Not Built Yet"
                  : statusData?.state === "failed"
                    ? "Analysis Failed"
                    : "Running pipeline"}
              </h2>

              <PipelineStepper
                steps={isMockMode() ? (steps ?? []) : liveSteps}
                states={isMockMode() ? states : liveStates}
                elapsed={isMockMode() ? elapsed : liveElapsed}
              />

              {isFailedNotImplemented && (
                <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                  <div className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <AlertCircle className="size-4 text-amber-500 shrink-0" />
                    Pipeline Stage Not Built Yet
                  </div>
                  {notImplementedStep && (
                    <div className="mt-2 text-xs space-y-1">
                      <p>
                        <b>Current Stage:</b> {notImplementedStep.label}
                      </p>
                      <p className="rounded bg-background/50 p-2 font-mono text-foreground border border-amber-500/20">
                        {notImplementedStep.log}
                      </p>
                    </div>
                  )}
                  {statusData?.error && (
                    <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                      {statusData.error}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetAnalysis}
                    className="mt-3 w-full border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15"
                  >
                    <RefreshCw className="mr-2 size-3.5" /> Back / Reset
                  </Button>
                </div>
              )}

              {statusData?.state === "failed" && !isFailedNotImplemented && (
                <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  <div className="font-semibold text-destructive">Pipeline Execution Error</div>
                  {failingStep && (
                    <div className="mt-2 text-xs space-y-1">
                      <p>
                        <b>Failed Step:</b> {failingStep.label}
                      </p>
                      <p className="rounded bg-background/50 p-2 font-mono text-foreground">
                        {failingStep.log}
                      </p>
                    </div>
                  )}
                  {statusData.error && <p className="mt-2 text-xs">{statusData.error}</p>}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetAnalysis}
                    className="mt-3 w-full"
                  >
                    <RefreshCw className="mr-2 size-3.5" /> Retry Analysis
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Recent runs</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          {recent?.map((r) => (
            <button
              key={r.runId}
              onClick={() => {
                setActiveRunId(r.runId);
                nav({ to: "/dashboard" });
              }}
              className="rounded border bg-card p-4 text-left transition-colors hover:border-foreground/20"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{r.areaName}</span>
                <span className="num text-xs text-muted-foreground">{fmtDate(r.eventDate)}</span>
              </div>
              <div className="mt-3 flex gap-5 text-xs text-muted-foreground">
                <span>
                  <span className="num text-base font-semibold text-foreground">
                    {r.floodedKm2}
                  </span>{" "}
                  km² flooded
                </span>
                <span>
                  <span className="num text-base font-semibold text-foreground">{r.cutOff}</span>{" "}
                  villages cut off
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
