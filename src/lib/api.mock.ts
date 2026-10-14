import mockRun from "@/data/mock-run.json";
import recentRuns from "@/data/recent-runs.json";
import pipelineSteps from "@/data/pipeline-steps.json";
import type { CopilotAnswer, Lang, PipelineStep, RecentRun, RunResult } from "./types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const run = mockRun as unknown as RunResult;

export { mockRun };

export async function getMockRunResult(_runId?: string): Promise<RunResult> {
  await delay(250);
  return run;
}

export async function getMockRecentRuns(): Promise<RecentRun[]> {
  await delay(150);
  return recentRuns as RecentRun[];
}

export async function getMockPipelineSteps(): Promise<PipelineStep[]> {
  return pipelineSteps as PipelineStep[];
}

export async function startMockAnalysis(req: {
  bbox: [number, number, number, number];
  floodDate: string;
  osmDate: string;
  useOptical: boolean;
}): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  await delay(300);
  if (req.osmDate >= req.floodDate) {
    return { ok: false, error: "The OSM snapshot must be dated before the flood event." };
  }
  return { ok: true, runId: run.runId };
}

const k = run.kpis;
const cut = run.villages
  .filter((v) => v.status === "cut_off")
  .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

const src = (display: string, layer: string, query: string) => ({
  display,
  layer,
  query,
  value: display,
  runId: run.runId,
});

const near2km = run.buildings.filter(
  (b) => b.status === "likely_hit" && b.distanceToRiverM !== null && b.distanceToRiverM <= 2000,
).length;

type Intent = { match: RegExp; build: (lang: Lang) => CopilotAnswer };

const intents: Intent[] = [
  {
    match: /cut.?off|isolat|काटि|villages? (are|is)/i,
    build: (lang) => ({
      available: true,
      tools: ["get_cutoff_villages()", "get_route_status(village_id)"],
      sources: {
        n: src(String(k.villagesCutOff), "villages", "count(status='cut_off')"),
        t: src(String(k.villagesTotal), "villages", "count(*)"),
      },
      markdown:
        lang === "en"
          ? `**\`#n\` of \`#t\` villages** have lost road access to the nearest hospital.\n\nRanked by priority:`
          : `**\`#t\` मध्ये \`#n\` गाउँहरू** नजिकको अस्पतालसम्म सडक सम्पर्कबाट टाढिएका छन्।\n\nप्राथमिकता अनुसार:`,
      table: {
        columns:
          lang === "en"
            ? ["Village", "Priority", "Before (km)", "Alternate"]
            : ["गाउँ", "प्राथमिकता", "पहिले (कि.मि.)", "वैकल्पिक"],
        rows: cut.map((v) => [
          v.name,
          v.priority != null ? v.priority : lang === "en" ? "Not available" : "उपलब्ध छैन",
          v.distanceBeforeKm,
          v.alternateRoute,
        ]),
      },
      miniMap: { villageIds: cut.map((v) => v.id) },
    }),
  },
  {
    match: /building|2 ?km|भवन/i,
    build: (lang) => ({
      available: true,
      tools: ["get_damage_summary(layer='buildings', within_m=2000)"],
      sources: {
        h: src(String(near2km), "buildings", "count(status='likely_hit' AND dist_river<=2000m)"),
        tot: src(String(k.buildingsTotal), "buildings", "count(*)"),
      },
      markdown:
        lang === "en"
          ? `\`#h\` buildings within 2 km of the river are marked **likely hit**, out of \`#tot\` mapped in the pre-event OSM snapshot.\n\n> At ~10 m resolution this is an area-level estimate, not a verdict on individual buildings.`
          : `नदीबाट २ कि.मि. भित्रका \`#h\` भवनहरू **सम्भावित प्रभावित** छन् (कुल \`#tot\` मध्ये)।\n\n> ~१० मि. रिजोल्युसनमा यो क्षेत्रगत अनुमान हो, प्रत्येक भवनको निर्णय होइन।`,
    }),
  },
  {
    match: /bridge|पुल/i,
    build: (lang) => ({
      available: true,
      tools: ["get_bridges(status='damaged')", "simulate_bridge_impact(bridge_id)"],
      sources: {
        b: src(String(k.bridgesLikelyDamaged), "bridges", "count(status='damaged')"),
      },
      markdown:
        lang === "en"
          ? `\`#b\` bridges are likely damaged.\n\n1. **Rasuwagadhi Bridge (B-1)** — crosses the Bhote Koshi near the border; approach spans and deck damaged.\n2. **Syaphrubesi Suspension Bridge (B-2)** — crosses the Langtang Khola; abutment area damaged.`
          : `\`#b\` पुलहरू सम्भावित क्षतिग्रस्त छन्।\n\n1. **रसुवागढी पुल (B-1)** — सीमा नजिक भोटेकोशी पार गर्छ; पहुँच र डेक क्षतिग्रस्त।\n2. **स्याफ्रुबेसी झोलुङ्गे पुल (B-2)** — लाङटाङ खोला पार गर्छ; जग क्षेत्र क्षतिग्रस्त।`,
    }),
  },
  {
    match: /summar|field team|सारांश/i,
    build: (lang) => ({
      available: true,
      tools: ["get_damage_summary()", "get_cutoff_villages()", "get_scene_metadata()"],
      sources: {
        f: src(String(k.floodedAreaKm2), "flood_mask", "sum(area_km2)"),
        r: src(String(k.roadLengthAffectedKm), "roads", "sum(length_km) where status='flooded'"),
        n: src(String(k.villagesCutOff), "villages", "count(status='cut_off')"),
        b: src(String(k.bridgesLikelyDamaged), "bridges", "count(status='damaged')"),
      },
      markdown:
        lang === "en"
          ? `**Situation, 26 Aug 2026 (radar, after-pass)**\n\n- Flooded area: \`#f\` km² along the Bhote Koshi/Trishuli.\n- \`#r\` km of road affected; \`#b\` bridges likely damaged.\n- \`#n\` villages cut off by road. Highest priority: **Rasuwagadhi**, **Syaphrubesi**.\n- Dhunche hospital remains reachable from the south.\n\n_Cut off by road only — foot trails may exist. Verify on the ground._`
          : `**स्थिति, २६ अगस्ट २०२६**\n\n- डुबान क्षेत्र: \`#f\` वर्ग कि.मि.\n- \`#r\` कि.मि. सडक प्रभावित; \`#b\` पुल सम्भावित क्षतिग्रस्त।\n- \`#n\` गाउँ सडकबाट अलग। उच्च प्राथमिकता: **रसुवागढी**, **स्याफ्रुबेसी**।\n\n_सडक मात्र — पैदल बाटो हुन सक्छ। स्थलगत पुष्टि गर्नुहोस्।_`,
    }),
  },
];

export async function askMockCopilot(question: string, lang: Lang): Promise<CopilotAnswer> {
  await delay(900);
  const hit = intents.find((i) => i.match.test(question));
  if (hit) return hit.build(lang);
  return {
    available: false,
    tools: ["search_layers(query)"],
    sources: {},
    markdown:
      lang === "en"
        ? "This isn't available in this analysis. The system only answers from its own map layers (flood, debris, buildings, roads, bridges, villages) and won't guess."
        : "यो जानकारी यस विश्लेषणमा उपलब्ध छैन। प्रणालीले आफ्नै नक्सा तहबाट मात्र उत्तर दिन्छ, अनुमान गर्दैन।",
  };
}

export async function getMockReport(
  lang: Lang,
): Promise<{ lang: Lang; generatedAt: string; run: RunResult; priority: RunResult["villages"] }> {
  await delay(500);
  return { lang, generatedAt: new Date().toISOString(), run, priority: cut.slice(0, 5) };
}
