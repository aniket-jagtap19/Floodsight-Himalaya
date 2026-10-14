import { ArrowUpDown, Crosshair, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MAP } from "@/lib/map-palette";
import type { LatLng, RunResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = { id: string; name: string; sub: string; hit: boolean; conf: number | null; at: LatLng };

export function DamageTables({ run, onZoom }: { run: RunResult; onZoom: (p: LatLng) => void }) {
  const sets: Record<string, Row[]> = useMemo(
    () => ({
      Buildings: run.buildings.map((b) => ({
        id: b.id,
        name: b.name,
        sub: b.category,
        hit: b.status === "likely_hit",
        conf: b.confidence,
        at: [b.lat, b.lon],
      })),
      Roads: run.roads.map((r) => ({
        id: r.id,
        name: r.name,
        sub: `${r.roadClass} · ${r.lengthKm} km`,
        hit: r.status === "flooded",
        conf: r.confidence,
        at: [r.coordinates[0]![1], r.coordinates[0]![0]],
      })),
      Bridges: run.bridges.map((b) => ({
        id: b.id,
        name: b.name,
        sub: "bridge",
        hit: b.status === "damaged",
        conf: b.confidence,
        at: [b.lat, b.lon],
      })),
    }),
    [run],
  );

  const catData = [
    {
      name: "Buildings",
      hit: run.kpis.buildingsLikelyHit,
      ok: run.kpis.buildingsTotal - run.kpis.buildingsLikelyHit,
    },
    {
      name: "Roads",
      hit: run.roads.filter((r) => r.status === "flooded").length,
      ok: run.roads.filter((r) => r.status === "intact").length,
    },
    {
      name: "Bridges",
      hit: run.kpis.bridgesLikelyDamaged,
      ok: run.kpis.bridgesTotal - run.kpis.bridgesLikelyDamaged,
    },
  ];
  const classData = ["primary", "secondary", "tertiary", "track"].map((c) => ({
    name: c,
    km: +run.roads
      .filter((r) => r.roadClass === c && r.status === "flooded")
      .reduce((s, r) => s + r.lengthKm, 0)
      .toFixed(1),
  }));
  const axis = { fontSize: 10, fill: "currentColor" };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="Buildings">
        <TabsList className="w-full">
          {Object.keys(sets).map((k) => (
            <TabsTrigger key={k} value={k} className="flex-1 text-xs">
              {k}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.entries(sets).map(([k, rows]) => (
          <TabsContent key={k} value={k}>
            <Table rows={rows} onZoom={onZoom} />
          </TabsContent>
        ))}
      </Tabs>
      <div className="rounded-xl border bg-card p-3 text-muted-foreground">
        <div className="mb-2 text-xs font-medium text-foreground">Damage by category</div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={catData} margin={{ left: -20, right: 4, top: 4 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              strokeOpacity={0.15}
              vertical={false}
            />
            <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} />
            <RTooltip
              cursor={{ fillOpacity: 0.05 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Bar dataKey="hit" stackId="a" name="Likely hit" fill={MAP.damage} />
            <Bar dataKey="ok" stackId="a" name="Not hit" fill={MAP.intact} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-xl border bg-card p-3 text-muted-foreground">
        <div className="mb-2 text-xs font-medium text-foreground">
          Affected road length by class (km)
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={classData} layout="vertical" margin={{ left: 0, right: 10 }}>
            <XAxis type="number" tick={axis} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={axis}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <RTooltip
              cursor={{ fillOpacity: 0.05 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Bar dataKey="km" fill={MAP.damage} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Table({ rows, onZoom }: { rows: Row[]; onZoom: (p: LatLng) => void }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "hit" | "ok">("all");
  const [asc, setAsc] = useState(false);
  const view = rows
    .filter((r) => (filter === "all" ? true : filter === "hit" ? r.hit : !r.hit))
    .filter((r) => (r.name + r.id + r.sub).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (asc ? (a.conf ?? 0) - (b.conf ?? 0) : (b.conf ?? 0) - (a.conf ?? 0)));
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
          aria-label="Filter by status"
        >
          <option value="all">All</option>
          <option value="hit">Likely hit</option>
          <option value="ok">Not hit</option>
        </select>
      </div>
      <div className="panel-scroll max-h-64 overflow-y-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-secondary text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5">Feature</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">
                <button
                  onClick={() => setAsc((a) => !a)}
                  className="inline-flex items-center gap-1"
                >
                  Conf. <ArrowUpDown className="size-3" />
                </button>
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {view.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                  No matching features.
                </td>
              </tr>
            )}
            {view.map((r) => (
              <tr key={r.id} className="border-t hover:bg-secondary/40">
                <td className="px-2 py-1.5">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="num text-[10px] text-muted-foreground">
                    {r.id} · {r.sub}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px]",
                      r.hit
                        ? "bg-foreground text-primary-foreground"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {r.hit ? "Likely hit" : "Not hit"}
                  </span>
                </td>
                <td className="num px-2 py-1.5">
                  {r.conf != null ? `${Math.round(r.conf * 100)}%` : "Not available"}
                </td>
                <td className="px-1">
                  <button
                    onClick={() => onZoom(r.at)}
                    aria-label={`Zoom to ${r.name}`}
                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Crosshair className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
