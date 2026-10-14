import { ArrowRight, Ban, HeartHandshake } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const PIPE = [
  "Sentinel-1 radar pair",
  "Preprocess (calibrate, terrain-correct, filter)",
  "Change detection",
  "Terrain masking (slope, HAND)",
  "Overlay pre-event OSM",
  "Damage + road-graph cut-off",
  "Copilot & report",
];

const FAQ = [
  [
    "How radar detects water",
    "Calm water reflects radar away from the satellite like a mirror, so flooded land turns dark in the image. Radar sees through clouds and works at night.",
  ],
  [
    "Why same-orbit comparison matters",
    "Comparing two passes from the same orbit track keeps the viewing angle identical, so changes in brightness come from the ground, not geometry.",
  ],
  [
    "Terrain false positives (radar shadow, slope, HAND)",
    "Steep valley sides hide areas from the radar (shadow) and look dark like water. Terrain masking excludes steep slopes and land elevated above drainage networks (HAND).",
  ],
  [
    "How damage is estimated",
    "Pre-event OSM buildings, roads and bridges are intersected with the flood and debris masks. A feature is 'likely hit' if enough of it overlaps. It's an area-level estimate.",
  ],
  [
    "How cut-off is computed (road graph)",
    "Roads become a network. Hit segments are removed, then we search for a path from each village to the nearest hospital or town. No path = cut off by road.",
  ],
  [
    "How the copilot avoids invented numbers",
    "The language model only chooses which tool to call and phrases the answer. Every number is copied from tool output and linked to its source layer and query.",
  ],
];

const CANNOT = [
  "No early warning — satellites revisit every few days.",
  "Satellite radar resolution does not support individual building verdicts.",
  "Radar shadow and smooth surfaces (roads, sand) can cause false positives.",
  "OpenStreetMap is incomplete in remote areas.",
  "'Cut off' means by road only — foot trails are not modelled.",
  "Cloud cover limits optical (Sentinel-2) data.",
  "An educational prototype, not an operational tool.",
];

const DATA = [
  ["Sentinel-1 SAR", "Copernicus open licence", "Before/after radar images for water detection"],
  ["Sentinel-2 MSI", "Copernicus open licence", "Optional optical check when cloud cover is low"],
  [
    "Copernicus DEM (WorldDEM-30)",
    "Copernicus DEM licence",
    "Terrain correction, slope and HAND masking",
  ],
  ["OpenStreetMap", "ODbL 1.0", "Pre-event buildings, roads, bridges, villages, hospitals"],
];

export function MethodsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Methods & limitations</h1>
        <p className="text-sm text-muted-foreground">
          How the system goes from satellite data to a situation report — and what it cannot do.
        </p>
      </div>

      <section className="flex flex-wrap items-center gap-2">
        {PIPE.map((p, i) => (
          <div key={p} className="flex items-center gap-2">
            <div className="rounded-xl border bg-card px-3 py-2.5 text-xs">
              <span className="num mr-1.5 text-muted-foreground">{i + 1}</span>
              {p}
            </div>
            {i < PIPE.length - 1 && <ArrowRight className="size-4 text-muted-foreground" />}
          </div>
        ))}
      </section>

      <Accordion type="single" collapsible className="rounded-xl border bg-card px-4">
        {FAQ.map(([q, a]) => (
          <AccordionItem key={q} value={q!}>
            <AccordionTrigger className="text-sm">{q}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <section className="rounded-xl border p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
          <Ban className="size-4" /> What this system cannot do
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CANNOT.map((c) => (
            <li key={c} className="flex gap-2 text-sm">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Data and licenses</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Dataset</th>
                <th className="px-4 py-2 font-medium">License</th>
                <th className="px-4 py-2 font-medium">How it's used</th>
              </tr>
            </thead>
            <tbody>
              {DATA.map((d) => (
                <tr key={d[0]} className="border-t">
                  {d.map((c, i) => (
                    <td
                      key={i}
                      className={
                        i === 0 ? "px-4 py-2 font-medium" : "px-4 py-2 text-muted-foreground"
                      }
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex gap-3 rounded-xl border bg-card p-5 text-sm">
        <HeartHandshake className="size-5 shrink-0 text-muted-foreground" />
        <div>
          <b>Responsible use.</b>{" "}
          <span className="text-muted-foreground">
            This case study is based on a real tragedy that affected real communities. No images of
            people or victims are used anywhere in this tool.
          </span>
        </div>
      </section>
    </div>
  );
}
