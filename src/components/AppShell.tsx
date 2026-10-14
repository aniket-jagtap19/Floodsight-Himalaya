import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Moon,
  PlusSquare,
  ShieldAlert,
  Sun,
  Target,
  Waves,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApp } from "@/lib/app-context";
import { fmtDate, runQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", key: "newAnalysis", icon: PlusSquare },
  { to: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { to: "/copilot", key: "copilot", icon: MessageSquareText },
  { to: "/report", key: "report", icon: FileText },
  { to: "/validation", key: "validation", icon: Target },
  { to: "/methods", key: "methods", icon: BookOpen },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang, theme, setTheme } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: run } = useQuery(runQuery);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="no-print flex h-14 shrink-0 items-center gap-4 border-b bg-sidebar px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded bg-primary/10 text-primary">
            <Waves className="size-4.5" />
          </span>
          <span className="text-sm font-semibold tracking-tight">{t.appName}</span>
        </Link>
        <div className="ml-2 hidden items-center gap-2 md:flex">
          <span className="rounded-md border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            {run?.areaName ?? "—"}
            <span className="mx-2 text-border">|</span>
            <span className="num text-foreground">{run ? fmtDate(run.eventDate) : "—"}</span>
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1.5 rounded border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground" />
                {run?.metadata.dataMode === "live" ? t.live : t.mock}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              <div className="mb-1 font-semibold">Provenance by section</div>
              {run?.provenance ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                  {Object.entries(run.provenance).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-1">
                      <span className="capitalize text-muted-foreground">{k}:</span>
                      <span className="font-mono">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>All figures come from local sample files, not a live satellite run.</p>
              )}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-md border p-0.5 text-xs" role="group" aria-label="Language">
            {(["en", "ne"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={cn(
                  "rounded px-2.5 py-1 transition-colors",
                  lang === l
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l === "en" ? "EN" : "नेपाली"}
              </button>
            ))}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="grid size-8 place-items-center rounded-md border text-muted-foreground hover:text-foreground"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{theme === "dark" ? "Light theme" : "Dark theme"}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="no-print flex shrink-0 items-center justify-center gap-2 border-b bg-secondary px-4 py-1.5 text-xs text-muted-foreground">
        <ShieldAlert className="size-3.5" />
        {t.banner}
      </div>

      <div className="flex min-h-0 flex-1">
        <nav
          className={cn(
            "no-print flex shrink-0 flex-col border-r bg-sidebar py-3 transition-[width] duration-200",
            collapsed ? "w-14" : "w-52",
          )}
          aria-label="Main"
        >
          <ul className="flex flex-1 flex-col gap-0.5 px-2">
            {NAV.map((n) => {
              const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
              const link = (
                <Link
                  to={n.to}
                  className={cn(
                    "flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <n.icon className={cn("size-4 shrink-0", active && "text-primary")} />
                  {!collapsed && <span className="truncate">{t[n.key]}</span>}
                </Link>
              );
              return (
                <li key={n.to}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{t[n.key]}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="mx-2 flex h-8 items-center gap-2 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-sidebar-accent/60"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <>
                <ChevronsLeft className="size-4" /> Collapse
              </>
            )}
          </button>
        </nav>

        <main className="panel-scroll min-w-0 flex-1 overflow-y-auto">
          {children}
          <Footer />
        </main>
      </div>
    </div>
  );
}

function Footer() {
  const { t } = useApp();
  return (
    <footer className="no-print border-t bg-surface px-6 py-4 text-[11px] leading-relaxed text-muted-foreground">
      <ul className="space-y-0.5">
        <li>Contains modified Copernicus Sentinel data 2026.</li>
        <li>
          Produced using Copernicus WorldDEM-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space
          GmbH 2014–2018 provided under COPERNICUS by the European Union and ESA; all rights
          reserved.
        </li>
        <li>© OpenStreetMap contributors.</li>
        <li>Training dataset: Kuro Siwo — Bountos et al., NeurIPS 2024.</li>
      </ul>
      <Link
        to="/methods"
        className="mt-2 inline-block text-primary underline-offset-2 hover:underline"
      >
        {t.methodsLink} →
      </Link>
    </footer>
  );
}
