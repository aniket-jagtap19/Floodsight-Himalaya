import { useQuery } from "@tanstack/react-query";
import { ShieldOff } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ValidationMap } from "@/components/map";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/lib/app-context";
import { MAP } from "@/lib/map-palette";
import { runQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function ValidationView() {
  const { theme } = useApp();
  const { data: run } = useQuery(runQuery);
  const [mode, setMode] = useState<"agreement" | "side">("agreement");
  if (!run)
    return (
      <div className="p-6">
        <Skeleton className="h-[600px] rounded-xl" />
      </div>
    );
  const v = run.validation;
  const dark = theme === "dark";

  if (!v) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-5 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">
              Case study: August 2026 Trishuli flood vs. Copernicus EMS EMSR927
            </h1>
            <p className="text-sm text-muted-foreground">Reference, used for checking only.</p>
          </div>
          <span className="flex items-center gap-2 rounded border bg-secondary px-3 py-2 text-sm font-medium text-muted-foreground">
            <ShieldOff className="size-4" /> Reference data was NOT used as input.
          </span>
        </div>

        <div className="rounded-xl border border-dashed bg-card p-12 text-center">
          <div className="mx-auto max-w-lg space-y-3">
            <h2 className="text-base font-semibold">Validation not computed</h2>
            <p className="text-sm text-muted-foreground">
              Validation has not been computed for this run. It is only calculated after the
              analysis result is produced, using the EMSR927 reference as a check, never as an
              input.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const metrics = [
    { l: "Precision", v: v.precision },
    { l: "Recall", v: v.recall },
    { l: "F1", v: v.f1 },
    { l: "IoU", v: v.iou },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Case study: August 2026 Trishuli flood vs. Copernicus EMS EMSR927
          </h1>
          <p className="text-sm text-muted-foreground">Reference, used for checking only.</p>
        </div>
        <span className="flex items-center gap-2 rounded border bg-secondary px-3 py-2 text-sm font-medium text-muted-foreground">
          <ShieldOff className="size-4" /> Reference data was NOT used as input.
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-2">
            {(["agreement", "side"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "rounded-md px-3 py-1 text-xs",
                  mode === m ? "bg-secondary" : "text-muted-foreground",
                )}
              >
                {m === "agreement" ? "Agreement layer" : "Side by side"}
              </button>
            ))}
            {mode === "agreement" && (
              <div className="ml-auto flex gap-3 text-[11px]">
                <Sw c="bg-safe" t="True positive" />
                <Sw c="bg-damage" t="False positive" />
                <Sw c="bg-debris" t="False negative" />
                <span className="text-muted-foreground">True negative hidden</span>
              </div>
            )}
          </div>
          {mode === "agreement" ? (
            <div className="h-[520px]">
              <ValidationMap run={run} mode="agreement" dark={dark} />
            </div>
          ) : (
            <div className="grid h-[520px] grid-cols-2 gap-px bg-border">
              <div className="relative">
                <ValidationMap run={run} mode="ours" dark={dark} />
                <Label t="Our flood map" />
              </div>
              <div className="relative">
                <ValidationMap run={run} mode="reference" dark={dark} />
                <Label t="EMSR927 reference" />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {metrics.map((m) => (
              <div key={m.l} className="rounded-xl border bg-card p-3">
                <div className="text-[11px] text-muted-foreground">{m.l}</div>
                <div className="num text-2xl font-semibold">{m.v.toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-3">
            <div className="text-[11px] text-muted-foreground">Area difference</div>
            <div className="num text-lg font-semibold">
              {(v.areaOursKm2 - v.areaRefKm2).toFixed(1)} km²{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({v.areaOursKm2} vs {v.areaRefKm2})
              </span>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <div className="mb-2 text-xs font-medium">Confusion summary (km²)</div>
            <div className="num grid grid-cols-[auto_1fr_1fr] gap-1 text-center text-xs">
              <span />
              <span className="text-[10px] text-muted-foreground">Ref: water</span>
              <span className="text-[10px] text-muted-foreground">Ref: dry</span>
              <span className="pr-2 text-left text-[10px] text-muted-foreground">Ours: water</span>
              <span className="rounded bg-safe/20 py-2">{v.tpKm2}</span>
              <span className="rounded bg-damage/20 py-2">{v.fpKm2}</span>
              <span className="pr-2 text-left text-[10px] text-muted-foreground">Ours: dry</span>
              <span className="rounded bg-debris/20 py-2">{v.fnKm2}</span>
              <span className="rounded bg-secondary py-2 text-muted-foreground">—</span>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-3 text-muted-foreground">
            <div className="mb-1 text-xs font-medium text-foreground">IoU across test areas</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={v.regions} margin={{ left: -24, top: 4 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  strokeOpacity={0.15}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="iou" fill={MAP.flood} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Region", "Date", "Orbit", "Cloud cover", "Precision", "Recall", "F1", "IoU"].map(
                (h) => (
                  <th key={h} className="px-4 py-2 font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {v.regions.map((r) => (
              <tr key={r.name} className="border-t">
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="num px-4 py-2">{r.date}</td>
                <td className="num px-4 py-2">{r.orbit}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.cloudCover}</td>
                {[r.precision, r.recall, r.f1, r.iou].map((x, i) => (
                  <td key={i} className="num px-4 py-2">
                    {x.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Sw = ({ c, t }: { c: string; t: string }) => (
  <span className="flex items-center gap-1">
    <span className={cn("size-2.5 rounded-sm", c)} />
    {t}
  </span>
);
const Label = ({ t }: { t: string }) => (
  <span className="absolute left-2 top-2 z-[500] rounded-md border bg-background/90 px-2 py-1 text-xs font-medium">
    {t}
  </span>
);
