import { createFileRoute } from "@tanstack/react-router";
import { ValidationView } from "@/components/ValidationView";

export const Route = createFileRoute("/validation")({
  head: () => ({
    meta: [
      { title: "Validation case study — FloodSight Himalaya" },
      {
        name: "description",
        content:
          "Trishuli flood map compared with Copernicus EMS EMSR927: precision, recall, F1 and IoU.",
      },
      { property: "og:title", content: "Validation case study — FloodSight Himalaya" },
      {
        property: "og:description",
        content: "How our flood map compares with the Copernicus EMS reference.",
      },
    ],
  }),
  component: ValidationView,
});
