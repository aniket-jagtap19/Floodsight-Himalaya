import { useQuery } from "@tanstack/react-query";
import { Copy, Download, RefreshCw } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { MiniMap } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getReport, getLiveReport, isMockMode } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import type { CopilotAnswer, Lang } from "@/lib/types";

const T = {
  en: {
    title: "Flood Situation Report",
    event: "Event",
    area: "Area",
    sources: "Data sources",
    key: "Key figures",
    map: "Map snapshot",
    top: "Top priority cut-off villages",
    infra: "Damaged infrastructure",
    limits: "Confidence and limitations",
    how: "How to read this report",
    howText:
      "Underlined numbers were inserted directly from the system's map layers. Red = damaged or cut off. 'Cut off' means no road route to the nearest hospital; foot trails may exist.",
    k: [
      "Flooded area (km²)",
      "Debris area (km²)",
      "Buildings likely hit",
      "Road affected (km)",
      "Bridges damaged",
      "Villages cut off",
    ],
    cols: ["Village", "Priority", "To hospital before", "Alternate"],
    infraText: (b: number, r: number, br: number) => [
      `${b} buildings likely hit`,
      `${r} km of road affected`,
      `${br} bridges likely damaged`,
    ],
    lim: [
      "~10 m radar resolution: no individual building verdicts.",
      "Radar shadow and smooth surfaces can cause false positives; steep slopes were masked.",
      "OSM may be incomplete in remote areas.",
      "Educational prototype — verify everything on the ground.",
    ],
    gen: "Generated",
    run: "Run",
  },
  ne: {
    title: "बाढी स्थिति प्रतिवेदन",
    event: "घटना",
    area: "क्षेत्र",
    sources: "डाटा स्रोत",
    key: "मुख्य तथ्याङ्क",
    map: "नक्सा",
    top: "उच्च प्राथमिकताका अलग गाउँहरू",
    infra: "क्षतिग्रस्त पूर्वाधार",
    limits: "विश्वसनीयता र सीमाहरू",
    how: "यो प्रतिवेदन कसरी पढ्ने",
    howText:
      "रेखाङ्कित अङ्कहरू प्रणालीको नक्सा तहबाट सिधै राखिएका हुन्। रातो = क्षतिग्रस्त वा अलग। 'अलग' भनेको नजिकको अस्पतालसम्म सडक नभएको; पैदल बाटो हुन सक्छ।",
    k: [
      "डुबान क्षेत्र (वर्ग कि.मि.)",
      "मलबा क्षेत्र (वर्ग कि.मि.)",
      "सम्भावित प्रभावित भवन",
      "प्रभावित सडक (कि.मि.)",
      "क्षतिग्रस्त पुल",
      "अलग गाउँ",
    ],
    cols: ["गाउँ", "प्राथमिकता", "अस्पतालसम्म (पहिले)", "वैकल्पिक"],
    infraText: (b: number, r: number, br: number) => [
      `${b} भवन सम्भावित प्रभावित`,
      `${r} कि.मि. सडक प्रभावित`,
      `${br} पुल सम्भावित क्षतिग्रस्त`,
    ],
    lim: [
      "~१० मि. रिजोल्युसन: प्रत्येक भवनको निर्णय होइन।",
      "राडार छाया र चिल्लो सतहले गलत संकेत दिन सक्छ।",
      "दुर्गम क्षेत्रमा OSM अपूर्ण हुन सक्छ।",
      "शैक्षिक प्रोटोटाइप — स्थलगत पुष्टि गर्नुहोस्।",
    ],
    gen: "तयार मिति",
    run: "रन",
  },
};

export function ReportPreview() {
  const { lang: appLang, theme } = useApp();
  const [lang, setLang] = useState<Lang>(appLang);
  const [nonce, setNonce] = useState(0);

  // Live mode: use AI report endpoint (returns CopilotAnswer markdown)
  const liveQuery = useQuery({
    queryKey: ["live-report", lang, nonce],
    queryFn: () => getLiveReport(lang),
    enabled: !isMockMode(),
  });

  // Mock mode: use existing rich static report
  const mockQuery = useQuery({
    queryKey: ["report", lang, nonce],
    queryFn: () => getReport(lang),
    enabled: isMockMode(),
  });

  const isFetching = isMockMode() ? mockQuery.isFetching : liveQuery.isFetching;
  const data = isMockMode() ? mockQuery.data : undefined;
  const liveReport: CopilotAnswer | undefined = !isMockMode() ? liveQuery.data : undefined;
  const t = T[lang];

  const copy = () => {
    if (!data) return;
    const k = data.run.kpis;
    const text = [
      `${t.title} — ${data.run.areaName} — ${data.run.eventDate}`,
      `${t.k[0]}: ${k.floodedAreaKm2}`,
      `${t.k[2]}: ${k.buildingsLikelyHit}`,
      `${t.k[3]}: ${k.roadLengthAffectedKm}`,
      `${t.k[4]}: ${k.bridgesLikelyDamaged}`,
      `${t.k[5]}: ${k.villagesCutOff}/${k.villagesTotal}`,
      `${t.top}: ${data.priority.map((v) => v.name).join(", ")}`,
      `${t.run}: ${data.run.runId}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Report text copied");
  };

  return (
    <div className="p-6">
      <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold tracking-tight">Situation report</h1>
        <div
          className="flex rounded-md border p-0.5 text-xs"
          role="group"
          aria-label="Report language"
        >
          {(["en", "ne"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={
                lang === l
                  ? "rounded bg-secondary px-2.5 py-1"
                  : "px-2.5 py-1 text-muted-foreground"
              }
            >
              {l === "en" ? "English" : "नेपाली"}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setNonce((n) => n + 1)}>
          <RefreshCw className={isFetching ? "size-3.5 animate-spin" : "size-3.5"} /> Regenerate
        </Button>
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy className="size-3.5" /> Copy text
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Download className="size-3.5" /> Download PDF
        </Button>
      </div>

      {(!data && !liveReport) || isFetching ? (
        <Skeleton className="mx-auto aspect-[210/297] max-w-[820px] rounded-sm" />
      ) : liveReport ? (
        // Live mode: render AI-generated markdown report
        <article className="print-page mx-auto max-w-[820px] rounded-sm border bg-card p-10 text-sm leading-relaxed shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t.title}</h2>
            {liveReport.note && (
              <div className="rounded border border-amber-400/40 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                {liveReport.note}
              </div>
            )}
          </div>
          {!liveReport.available ? (
            <p className="text-muted-foreground">{liveReport.markdown}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none space-y-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground">
              <ReactMarkdown>{liveReport.markdown}</ReactMarkdown>
            </div>
          )}
          {liveReport.tools.length > 0 && (
            <details className="mt-6 text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">
                Data sources ({liveReport.tools.length} tools)
              </summary>
              <ul className="mt-1 list-disc pl-4">
                {liveReport.tools.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </details>
          )}
        </article>
      ) : data ? (
        // Mock mode: existing rich static report
        <article className="print-page mx-auto aspect-[210/297] max-w-[820px] rounded-sm border bg-card p-10 text-[12px] leading-relaxed shadow-2xl">
          <header className="flex items-start justify-between border-b pb-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Educational prototype · sample data
              </div>
              <h2 className="mt-1 text-2xl font-semibold">{t.title}</h2>
              <p className="text-muted-foreground">
                {t.event}: <b className="text-foreground">{data.run.eventDate}</b> · {t.area}:{" "}
                <b className="text-foreground">{data.run.areaName}</b>
              </p>
            </div>
            <div className="num text-right text-[10px] text-muted-foreground">
              <div>
                {t.gen}: {new Date(data.generatedAt).toISOString().replace("T", " ").slice(0, 16)}{" "}
                UTC
              </div>
              <div>
                {t.run}: {data.run.runId}
              </div>
            </div>
          </header>

          <div className="mt-4 grid grid-cols-[1fr_260px] gap-5">
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.key}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  data.run.kpis.floodedAreaKm2,
                  data.run.kpis.debrisAreaKm2,
                  data.run.kpis.buildingsLikelyHit,
                  data.run.kpis.roadLengthAffectedKm,
                  data.run.kpis.bridgesLikelyDamaged,
                  `${data.run.kpis.villagesCutOff}/${data.run.kpis.villagesTotal}`,
                ].map((v, i) => (
                  <div key={i} className="rounded-lg border p-2">
                    <div className="text-[10px] text-muted-foreground">{t.k[i]}</div>
                    <div className="data-num text-lg font-semibold">{v}</div>
                  </div>
                ))}
              </div>
              <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.sources}
              </h3>
              <ul className="num space-y-0.5 text-[10.5px]">
                {data.run.scenes
                  .filter((s) => s.role !== "event")
                  .map((s) => (
                    <li key={s.id}>
                      {s.sensor} · {s.date} · {s.orbit}
                      {s.cloudCover != null && ` · ${s.cloudCover}% cloud`}
                    </li>
                  ))}
                <li>OSM snapshot · {data.run.osmSnapshotDate}</li>
                <li>Copernicus DEM</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.map}
              </h3>
              <MiniMap run={data.run} dark={theme === "dark"} height={250} />
            </div>
          </div>

          <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t.top}
          </h3>
          <table className="w-full text-[11px]">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                {t.cols.map((c) => (
                  <th key={c} className="py-1 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.priority.map((v) => (
                <tr key={v.id} className="border-b">
                  <td className="py-1 font-medium">{v.name}</td>
                  <td>
                    <span className="data-num">
                      {v.priority != null
                        ? v.priority
                        : lang === "en"
                          ? "Not available"
                          : "उपलब्ध छैन"}
                    </span>
                  </td>
                  <td>
                    <span className="data-num">
                      {v.distanceBeforeKm != null
                        ? v.distanceBeforeKm
                        : lang === "en"
                          ? "Not available"
                          : "उपलब्ध छैन"}
                    </span>{" "}
                    km
                  </td>
                  <td>{v.alternateRoute}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-5 grid grid-cols-2 gap-5">
            <div>
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.infra}
              </h3>
              <ul className="list-disc pl-4">
                {t
                  .infraText(
                    data.run.kpis.buildingsLikelyHit,
                    data.run.kpis.roadLengthAffectedKm,
                    data.run.kpis.bridgesLikelyDamaged,
                  )
                  .map((s) => {
                    const [n, ...rest] = s.split(" ");
                    return (
                      <li key={s}>
                        <span className="data-num">{n}</span> {rest.join(" ")}
                      </li>
                    );
                  })}
              </ul>
            </div>
            <div className="rounded-lg border p-3">
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.limits}
              </h3>
              <ul className="list-disc space-y-0.5 pl-4 text-[11px]">
                {t.lim.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-secondary p-3 text-[11px]">
            <b>{t.how}.</b> {t.howText}
          </div>

          <footer className="mt-4 border-t pt-2 text-[9px] leading-snug text-muted-foreground">
            Contains modified Copernicus Sentinel data 2026. Produced using Copernicus DEM provided
            under COPERNICUS by the European Union and ESA; all rights reserved. © OpenStreetMap
            contributors.
          </footer>
        </article>
      ) : null}
    </div>
  );
}
