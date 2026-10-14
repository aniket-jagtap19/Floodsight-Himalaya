import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PipelineStepper } from "@/components/PipelineStepper";
import { RunStatusSchema, RunStatusStepSchema } from "@/lib/schemas";
import type { PipelineStep } from "@/lib/types";

describe("Prompt 4: not_implemented and failed_not_implemented states", () => {
  it("RunStatusStepSchema validates not_implemented state", () => {
    const rawStep = {
      id: 1,
      label: "Find satellite scenes",
      log: "Sentinel-1 scene acquisition has not been implemented.",
      state: "not_implemented",
      durationMs: 12,
    };
    const parsed = RunStatusStepSchema.parse(rawStep);
    expect(parsed.state).toBe("not_implemented");
  });

  it("RunStatusSchema validates failed_not_implemented state", () => {
    const rawStatus = {
      runId: "run-test-not-impl",
      state: "failed_not_implemented",
      steps: [
        {
          id: 1,
          label: "Find satellite scenes",
          log: "Sentinel-1 scene acquisition has not been implemented.",
          state: "not_implemented",
        },
      ],
      error:
        "Pipeline stage not implemented: Sentinel-1 scene acquisition has not been implemented.",
    };
    const parsed = RunStatusSchema.parse(rawStatus);
    expect(parsed.state).toBe("failed_not_implemented");
    expect(parsed.steps[0]?.state).toBe("not_implemented");
  });

  it("PipelineStepper renders 'Not built yet' badge for not_implemented steps", () => {
    const mockSteps: PipelineStep[] = [
      {
        id: 1,
        label: "Find satellite scenes",
        log: "Sentinel-1 scene acquisition has not been implemented.",
        durationMs: 15,
      },
      {
        id: 2,
        label: "Preprocess radar",
        log: "Pending",
        durationMs: 0,
      },
    ];

    render(
      <PipelineStepper
        steps={mockSteps}
        states={["not_implemented", "pending"]}
        elapsed={[15, 0]}
      />,
    );

    expect(screen.getByText("Not built yet")).toBeInTheDocument();
    expect(screen.getByText("Find satellite scenes")).toBeInTheDocument();
    expect(
      screen.getByText(/Sentinel-1 scene acquisition has not been implemented/),
    ).toBeInTheDocument();
  });
});
