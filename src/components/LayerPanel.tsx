import { Eye, EyeOff, Layers } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { BasemapKey, LayerState } from "@/components/map";
import { cn } from "@/lib/utils";

const ITEMS: { key: keyof LayerState; label: string; swatch: string }[] = [
  { key: "flood", label: "Flood water", swatch: "bg-flood" },
  { key: "debris", label: "Debris / mud", swatch: "bg-debris" },
  {
    key: "confidence",
    label: "Low confidence",
    swatch: "hatch border border-dashed border-foreground/60",
  },
  {
    key: "radar",
    label: "Radar before / after",
    swatch: "bg-gradient-to-r from-muted-foreground to-foreground",
  },
  { key: "buildings", label: "Buildings", swatch: "bg-damage rounded-full" },
  { key: "roads", label: "Roads", swatch: "bg-damage h-1" },
  { key: "bridges", label: "Bridges", swatch: "bg-intact rounded-full" },
  { key: "villages", label: "Villages", swatch: "bg-safe rounded-full" },
  { key: "facilities", label: "Hospitals & towns", swatch: "bg-medical" },
  { key: "flow", label: "Flow path", swatch: "border-t-2 border-dashed border-flood h-0" },
  {
    key: "terrain",
    label: "Hillshade & radar shadow",
    swatch: "bg-intact/50 border border-dashed border-intact",
  },
];

export const BASEMAP_LABELS: Record<Exclude<BasemapKey, "light">, string> = {
  dark: "Dark",
  satellite: "Satellite",
  terrain: "Terrain",
};

export function LayerPanel({
  layers,
  setLayers,
  basemap,
  setBasemap,
}: {
  layers: LayerState;
  setLayers: (l: LayerState) => void;
  basemap: BasemapKey;
  setBasemap: (b: BasemapKey) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
        <Layers className="size-4" /> Layers
      </div>
      <div className="border-b p-3">
        <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          Basemap
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-md border p-0.5">
          {(Object.keys(BASEMAP_LABELS) as (keyof typeof BASEMAP_LABELS)[]).map((b) => (
            <button
              key={b}
              onClick={() => setBasemap(b)}
              aria-pressed={basemap === b}
              className={cn(
                "rounded px-2 py-1 text-xs",
                basemap === b
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {BASEMAP_LABELS[b]}
            </button>
          ))}
        </div>
      </div>
      <ul className="panel-scroll flex-1 space-y-0.5 overflow-y-auto p-2">
        {ITEMS.map((it) => {
          const l = layers[it.key];
          return (
            <li key={it.key} className="rounded-lg px-2 py-2 hover:bg-secondary/50">
              <div className="flex items-center gap-2.5">
                <span className="grid h-3 w-4 place-items-center">
                  <span className={cn("block h-3 w-4 rounded-sm", it.swatch)} />
                </span>
                <span className={cn("flex-1 text-xs", !l.on && "text-muted-foreground")}>
                  {it.label}
                </span>
                <Switch
                  checked={l.on}
                  onCheckedChange={(on) => setLayers({ ...layers, [it.key]: { ...l, on } })}
                  aria-label={`Toggle ${it.label}`}
                  className="scale-75"
                />
              </div>
              {l.on && (
                <div className="mt-1.5 flex items-center gap-2 pl-6.5">
                  {l.opacity > 0 ? (
                    <Eye className="size-3 text-muted-foreground" />
                  ) : (
                    <EyeOff className="size-3 text-muted-foreground" />
                  )}
                  <Slider
                    value={[l.opacity * 100]}
                    onValueChange={([v]) =>
                      setLayers({ ...layers, [it.key]: { ...l, opacity: (v ?? 0) / 100 } })
                    }
                    max={100}
                    step={5}
                    aria-label={`${it.label} opacity`}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="border-t p-3 text-[11px] text-muted-foreground">
        <div className="mb-1.5 uppercase tracking-wider">Legend</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <Lg c="bg-damage" t="Damaged / cut off" />
          <Lg c="bg-safe" t="Connected" />
          <Lg c="bg-intact" t="Intact / not hit" />
          <Lg c="bg-medical" t="Hospital" />
        </div>
      </div>
    </div>
  );
}

function Lg({ c, t }: { c: string; t: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-full", c)} />
      {t}
    </span>
  );
}
