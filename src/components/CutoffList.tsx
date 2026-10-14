import { Footprints, Route as RouteIcon } from "lucide-react";
import type { Village } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CutoffList({
  villages,
  selectedId,
  onSelect,
}: {
  villages: Village[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const cut = villages
    .filter((v) => v.status === "cut_off")
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const ok = villages.filter((v) => v.status === "connected");
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border bg-secondary p-2.5 text-[11px] text-muted-foreground">
        <Footprints className="mt-0.5 size-3.5 shrink-0" /> Cut off by road only. Foot trails may
        exist.
      </div>
      <ol className="space-y-2">
        {cut.map((v, i) => (
          <li key={v.id}>
            <button
              onClick={() => onSelect(v.id)}
              className={cn(
                "w-full rounded border bg-card p-3 text-left transition-colors hover:border-foreground/30",
                selectedId === v.id && "border-foreground ring-1 ring-foreground/20",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="num grid size-5 place-items-center rounded bg-secondary text-[11px] text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium">{v.name}</span>
                <span className="rounded px-2 py-0.5 text-[10px] font-medium bg-secondary text-foreground">
                  Priority{" "}
                  <span className="num">{v.priority != null ? v.priority : "Not available"}</span>
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-muted-foreground">To hospital before </span>
                  <span className="num">
                    {v.distanceBeforeKm != null ? `${v.distanceBeforeKm} km` : "Not available"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">After </span>
                  <span className="font-medium text-foreground">no road route</span>
                </div>
              </div>
              {v.reason && <p className="mt-1.5 text-[11px] text-muted-foreground">{v.reason}</p>}
              <p className="mt-1.5 flex items-center gap-1 text-[11px]">
                <RouteIcon className="size-3 text-muted-foreground" />
                {v.alternateRoute}
              </p>
              <p className="num mt-1 text-[10px] text-muted-foreground">
                {v.confidence != null
                  ? `conf. ${Math.round(v.confidence * 100)}%`
                  : "conf. Not available"}
              </p>
            </button>
          </li>
        ))}
      </ol>
      <div>
        <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          Still connected
        </div>
        <ul className="space-y-1">
          {ok.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => onSelect(v.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-secondary/60",
                  selectedId === v.id && "bg-secondary",
                )}
              >
                <span className="size-2 rounded-full bg-muted-foreground" />
                <span className="flex-1">{v.name}</span>
                <span className="num text-muted-foreground">
                  {v.distanceAfterKm != null ? `${v.distanceAfterKm} km` : "Not available"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
