import { createFileRoute } from "@tanstack/react-router";
import { MethodsPage } from "@/components/MethodsPage";

export const Route = createFileRoute("/methods")({
  head: () => ({
    meta: [
      { title: "Methods & limitations — FloodSight Himalaya" },
      {
        name: "description",
        content:
          "How radar flood mapping, damage estimation and cut-off analysis work, and what the system cannot do.",
      },
      { property: "og:title", content: "Methods & limitations — FloodSight Himalaya" },
      { property: "og:description", content: "How the flood analysis works and its limitations." },
    ],
  }),
  component: MethodsPage,
});
