import { createFileRoute } from "@tanstack/react-router";
import { CopilotChat } from "@/components/CopilotChat";

export const Route = createFileRoute("/copilot")({
  head: () => ({
    meta: [
      { title: "Copilot — FloodSight Himalaya" },
      {
        name: "description",
        content:
          "Ask questions about the flood analysis. Every number links to the map layer it came from.",
      },
      { property: "og:title", content: "Copilot — FloodSight Himalaya" },
      {
        property: "og:description",
        content: "Ask questions about the flood analysis with traceable numbers.",
      },
    ],
  }),
  component: CopilotChat,
});
