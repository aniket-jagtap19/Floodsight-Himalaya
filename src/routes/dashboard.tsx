import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cloud, Columns2, Maximize, PanelLeftClose, PanelLeftOpen, Satellite } from "lucide-react";
import { useMemo, useState } from "react";
import { MapView, type BasemapKey, type LayerState } from "@/components/map";
import { LayerPanel } from "@/components/LayerPanel";
import { KpiCards } from "@/components/KpiCards";
import { DamageTables } from "@/components/DamageTables";
import { CutoffList } from "@/components/CutoffList";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtDate, runQuery } from "@/lib/queries";
import type { LatLng, RunResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FloodSight Himalaya" },
      {
        name: "description",
        content: "Flood extent, damaged roads and bridges, and cut-off villages on one map.",
      },
      { property: "og:title", content: "Flood impact dashboard — FloodSight Himalaya" },
      {
        property: "og:description",
        content: "Flood extent, damaged infrastructure and cut-off villages on one map.",
      },
    ],
  }),
  component: Dashboard,
});

const L = (on: boolean, opacity = 1) => ({ on, opacity });
const DEFAULT_LAYERS: LayerState = {
  flood: L(true),
  debris: L(true),
  confidence: L(true),
  radar: L(false),
  buildings: L(true),
  roads: L(true),
  bridges: L(true),
  villages: L(true),
  facilities: L(true),
  flow: L(false),
  terrain: L(false),
};

type Focus = {
  bounds?: [[number, number], [number, number]];
  center?: LatLng;
  zoom?: number;
  key: number;
} | null;

function Dashboard() {
  const { data: run, isLoading, error } = useQuery(runQuery);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [basemap, setBasemap] = useState<BasemapKey>("terrain");
  const [panel, setPanel] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [swipe, setSwipe] = useState({ on: false, pct: 0.5 });
  const [focus, setFocus] = useState<Focus>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [tab, setTab] = useState("summary");

  const selected = useMemo(() => run?.villages.find((v) => v.id === sel) ?? null, [run, sel]);

  if (error)
    return (
      <div className="p-10 text-sm text-destructive">
        Could not load this run. Try again from New analysis.
      </div>
    );
  if (isLoading || !run)
    return (
      <div className="grid h-[calc(100vh-5.5rem)] grid-cols-[240px_1fr_380px] gap-px">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );

  const selectVillage = (id: string | null) => {
    setSel(id);
    const v = run.villages.find((x) => x.id === id);
    if (v) {
      const lats = v.route.coordinates.map((c) => c[0]);
      const lngs = v.route.coordinates.map((c) => c[1]);
      setFocus({
        bounds: [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ],
        key: Date.now(),
      });
      setTab("cutoff");
    }
  };

  const fitFlood = () => {
    setFocus({
      bounds: [
        [run.bbox[1], run.bbox[0]],
        [run.bbox[3], run.bbox[2]],
      ],
      key: Date.now(),
    });
  };
  const isNotLive = run ? Object.values(run.provenance ?? {}).some((v) => v !== "live") : false;

  return (
    <div className="flex h-[calc(100vh-5.5rem)] flex-col">
      {isNotLive && (
        <div className="no-print flex shrink-0 items-center justify-center border-b bg-secondary px-4 py-1.5 text-xs font-medium text-muted-foreground">
          Demo data: some results on this page are placeholders, not computed from satellite
          imagery.
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {panel && (
          <aside className="w-60 shrink-0 border-r bg-card">
            <LayerPanel
              layers={layers}
              setLayers={setLayers}
              basemap={basemap}
              setBasemap={setBasemap}
            />
          </aside>
        )}
        <div className="relative min-w-0 flex-1">
          <MapView
            run={run}
            layers={layers}
            basemap={basemap}
            selectedVillage={selected}
            onSelectVillage={selectVillage}
            swipe={swipe}
            focus={focus}
            onCoords={setCoords}
          />

          <div className="absolute left-3 top-3 z-[500] flex gap-2">
            <MapBtn
              label={panel ? "Hide layers" : "Show layers"}
              onClick={() => setPanel((p) => !p)}
            >
              {panel ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </MapBtn>
            <MapBtn label="Fit to flood" onClick={fitFlood}>
              <Maximize className="size-4" />
            </MapBtn>
            <MapBtn
              label="Before / after swipe"
              active={swipe.on}
              onClick={() => setSwipe((s) => ({ ...s, on: !s.on }))}
            >
              <Columns2 className="size-4" />
            </MapBtn>
          </div>
          <span className="pointer-events-none absolute right-3 top-3 z-[500] rounded border border-border bg-background/80 px-2 py-1 text-[10px] font-medium tracking-widest text-muted-foreground">
            SAMPLE DATA
          </span>

          {swipe.on && (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 z-[450] w-0.5 bg-foreground/80"
                style={{ left: `${swipe.pct * 100}%` }}
              />
              <div className="absolute bottom-10 left-1/2 z-[500] flex w-80 -translate-x-1/2 items-center gap-3 rounded-lg border bg-background/90 px-3 py-2 text-[11px]">
                <span className="num">Before 14 Aug</span>
                <Slider
                  value={[swipe.pct * 100]}
                  onValueChange={([v]) => setSwipe({ on: true, pct: (v ?? 0) / 100 })}
                  max={100}
                  aria-label="Swipe position"
                />
                <span className="num">After 26 Aug</span>
              </div>
            </>
          )}
          {coords && (
            <span className="num pointer-events-none absolute bottom-2 right-2 z-[500] rounded bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground">
              {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E
            </span>
          )}
        </div>
        <aside className="w-[380px] shrink-0 border-l bg-card">
          <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col gap-0">
            <TabsList className="m-3 mb-0 grid grid-cols-3">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="damage">Damage</TabsTrigger>
              <TabsTrigger value="cutoff">
                Cut off{" "}
                <span className="num ml-1 rounded bg-secondary px-1 text-[10px] text-muted-foreground">
                  {run.kpis.villagesCutOff}
                </span>
              </TabsTrigger>
            </TabsList>
            <div className="panel-scroll min-h-0 flex-1 overflow-y-auto p-3">
              <TabsContent value="summary" className="mt-0">
                <KpiCards k={run.kpis} />
              </TabsContent>
              <TabsContent value="damage" className="mt-0">
                <DamageTables
                  run={run}
                  onZoom={(p) => setFocus({ center: p, zoom: 15, key: Date.now() })}
                />
              </TabsContent>
              <TabsContent value="cutoff" className="mt-0">
                <CutoffList villages={run.villages} selectedId={sel} onSelect={selectVillage} />
              </TabsContent>
            </div>
          </Tabs>
        </aside>
      </div>
      <Timeline run={run} />
    </div>
  );
}

function MapBtn({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={label}
          className={cn(
            "grid size-9 place-items-center rounded-lg border bg-background/90 text-foreground hover:bg-secondary",
            active && "border-primary text-primary",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Timeline({ run }: { run: RunResult }) {
  const dates = run.scenes.map((s) => +new Date(s.date));
  const min = Math.min(...dates) - 864e5,
    max = Math.max(...dates) + 864e5;
  return (
    <div className="flex h-[72px] shrink-0 items-center gap-6 border-t bg-card px-5">
      <div className="relative h-full flex-1">
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        {run.scenes.map((s) => {
          const left = ((+new Date(s.date) - min) / (max - min)) * 100;
          const ev = s.role === "event";
          return (
            <Tooltip key={s.id}>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
                  style={{ left: `${left}%` }}
                >
                  <div
                    className={cn(
                      "mx-auto grid size-6 place-items-center rounded-full border-2 bg-card",
                      ev
                        ? "border-damage"
                        : s.role === "optical"
                          ? "border-debris"
                          : "border-flood",
                    )}
                  >
                    {s.role === "optical" ? (
                      <Cloud className="size-3 text-debris" />
                    ) : ev ? (
                      <span className="size-2 rounded-full bg-damage" />
                    ) : (
                      <Satellite className="size-3 text-flood" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "num absolute left-1/2 mt-0.5 -translate-x-1/2 whitespace-nowrap text-[10px]",
                      s.role === "after" && "top-[-18px]",
                    )}
                  >
                    {ev ? "Flood" : s.role === "optical" ? `S2 · ${s.cloudCover}% cloud` : s.role}
                    <span className="ml-1 text-muted-foreground">
                      {fmtDate(s.date).replace(" 2026", "")}
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {s.sensor} · {s.orbit || "event"} · {s.date}
                {s.cloudCover != null && ` · ${s.cloudCover}% cloud`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <p className="w-64 text-[11px] leading-snug text-muted-foreground">
        <b className="text-foreground">Data freshness:</b> satellites revisit every few days, so
        this is a post-event map — not a real-time warning.
      </p>
    </div>
  );
}
