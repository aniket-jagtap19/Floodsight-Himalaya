import { AlertCircle, AlertTriangle, Check, Circle, Loader2, XCircle } from "lucide-react";
import type { PipelineStep } from "@/lib/types";
import { cn } from "@/lib/utils";

export type StepState = "pending" | "running" | "done" | "warning" | "failed" | "not_implemented";

export function PipelineStepper({
  steps,
  states,
  elapsed,
}: {
  steps: PipelineStep[];
  states: StepState[];
  elapsed: number[];
}) {
  return (
    <ol className="space-y-1" aria-live="polite">
      {steps.map((s, i) => {
        const st = states[i];
        return (
          <li
            key={s.id}
            className={cn(
              "flex gap-3 rounded-lg px-3 py-2 transition-colors",
              st === "running" && "bg-secondary/50",
              st === "failed" && "bg-destructive/10",
              st === "not_implemented" && "bg-amber-500/10 border border-amber-500/20",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                st === "done" && "border-foreground/40 bg-foreground/10 text-foreground",
                st === "warning" && "border-warning bg-warning/15 text-warning",
                st === "failed" && "border-destructive bg-destructive/15 text-destructive",
                st === "not_implemented" && "border-amber-500 bg-amber-500/20 text-amber-500",
                st === "running" && "border-foreground text-foreground",
                st === "pending" && "text-muted-foreground",
              )}
            >
              {st === "done" && <Check className="size-3" />}
              {st === "warning" && <AlertTriangle className="size-3" />}
              {st === "failed" && <XCircle className="size-3" />}
              {st === "not_implemented" && <AlertCircle className="size-3 text-amber-500" />}
              {st === "running" && <Loader2 className="size-3 animate-spin" />}
              {st === "pending" && <Circle className="size-2" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "text-sm flex items-center flex-wrap gap-1.5",
                    st === "pending" ? "text-muted-foreground" : "font-medium",
                    st === "failed" && "text-destructive",
                    st === "not_implemented" && "text-amber-600 dark:text-amber-400",
                  )}
                >
                  <span className="num text-xs text-muted-foreground">{s.id}</span>
                  {s.label}
                  {st === "not_implemented" && (
                    <span className="rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      Not built yet
                    </span>
                  )}
                </span>
                {st !== "pending" && (
                  <span className="num text-xs text-muted-foreground">
                    {((elapsed[i] ?? 0) / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              {st !== "pending" && st !== "not_implemented" && (
                <p className="num mt-0.5 truncate text-[11px] text-muted-foreground">› {s.log}</p>
              )}
              {st === "not_implemented" && s.log && (
                <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">› {s.log}</p>
              )}
              {st === "warning" && s.warning && (
                <p className="mt-0.5 text-[11px] text-warning">{s.warning}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
