import { createFileRoute } from "@tanstack/react-router";
import { ReportPreview } from "@/components/ReportPreview";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Situation report — FloodSight Himalaya" },
      {
        name: "description",
        content: "One-page printable flood situation report in English and Nepali.",
      },
      { property: "og:title", content: "Situation report — FloodSight Himalaya" },
      {
        property: "og:description",
        content: "Printable flood situation report generated from the analysis.",
      },
    ],
  }),
  component: ReportPreview,
});
