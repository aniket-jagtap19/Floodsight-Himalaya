import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Kpis } from "@/lib/types";
import { cn } from "@/lib/utils";

export function KpiCards({ k, compact }: { k: Kpis; compact?: boolean }) {
  const items = [
    {
      label: "Flooded area",
      value: k.floodedAreaKm2,
      unit: "km\u00b2",
      how: "Sum of water polygons after removing terrain false positives.",
    },
    {
      label: "Debris area",
      value: k.debrisAreaKm2,
      unit: "km\u00b2",
      how: "Area where radar brightness rose sharply along the channel (mud, boulders).",
    },
    {
      label: "Buildings likely hit",
      value: k.buildingsLikelyHit,
      of: k.buildingsTotal,
      how: "Pre-event OSM buildings intersecting the flood or debris mask.",
    },
    {
      label: "Road affected",
      value: k.roadLengthAffectedKm,
      unit: "km",
      how: "Length of OSM road segments overlapping the flood or debris mask.",
    },
    {
      label: "Bridges likely damaged",
      value: k.bridgesLikelyDamaged,
      of: k.bridgesTotal,
      how: "Bridges whose span or approaches fall inside the mask or show signal loss.",
    },
    {
      label: "Villages cut off",
      value: k.villagesCutOff,
      of: k.villagesTotal,
      how: "No road path to the nearest hospital or town once hit roads are removed.",
    },
  ];
  return (
    <div className="space-y-2">
      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-2")}>
        {items.map((i) => (
          <div key={i.label} className="rounded border bg-card p-3">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[11px] leading-tight text-muted-foreground">{i.label}</span>
              <How text={i.how} />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="num text-2xl font-semibold text-foreground">
                {i.value != null ? i.value : "Not available"}
              </span>
              {i.value != null && i.unit && (
                <span className="text-xs text-muted-foreground">{i.unit}</span>
              )}
              {i.of != null && <span className="num text-xs text-muted-foreground">/ {i.of}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function How({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label="How is this computed?"
          className="text-muted-foreground hover:text-foreground"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">
        <b>How is this computed?</b>
        <br />
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
