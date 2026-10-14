import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "./types";
import { getActiveRunId, setActiveRunId as setActiveRunIdApi } from "./api";

const dict = {
  en: {
    appName: "FloodSight Himalaya",
    newAnalysis: "New analysis",
    dashboard: "Dashboard",
    copilot: "Copilot",
    report: "Situation report",
    validation: "Validation",
    methods: "Methods & limits",
    banner: "Educational prototype. Not an operational tool. Do not use for real rescue decisions.",
    mock: "Mock data",
    live: "Live run",
    methodsLink: "Methods and Limitations",
  },
  ne: {
    appName: "फ्लडसाइट हिमालय",
    newAnalysis: "नयाँ विश्लेषण",
    dashboard: "ड्यासबोर्ड",
    copilot: "सहायक",
    report: "स्थिति प्रतिवेदन",
    validation: "प्रमाणीकरण",
    methods: "विधि र सीमाहरू",
    banner: "शैक्षिक प्रोटोटाइप। वास्तविक उद्धार निर्णयका लागि प्रयोग नगर्नुहोस्।",
    mock: "नमूना डाटा",
    live: "प्रत्यक्ष",
    methodsLink: "विधि र सीमाहरू",
  },
} as const;

type Dict = Record<keyof (typeof dict)["en"], string>;

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  t: Dict;
  activeRunId: string;
  setActiveRunId: (id: string) => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [activeRunId, setActiveRunIdState] = useState<string>(() => getActiveRunId());

  const setActiveRunId = (id: string) => {
    setActiveRunIdState(id);
    setActiveRunIdApi(id);
  };

  useEffect(() => {
    const s = localStorage.getItem("fs-theme");
    if (s === "light" || s === "dark") setTheme(s);
    else setTheme("light"); // default to light monochrome theme
    const l = localStorage.getItem("fs-lang");
    if (l === "en" || l === "ne") setLang(l);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("fs-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang === "ne" ? "ne" : "en";
    localStorage.setItem("fs-lang", lang);
  }, [lang]);

  return (
    <AppCtx.Provider
      value={{ lang, setLang, theme, setTheme, t: dict[lang], activeRunId, setActiveRunId }}
    >
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
