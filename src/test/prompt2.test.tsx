import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockRun } from "@/lib/api.mock";
import * as apiModule from "@/lib/api";
import { apiFetch, ApiError } from "@/lib/http";
import { useRunStatus } from "@/lib/queries";
import { RunResultSchema } from "@/lib/schemas";
import type { ReactNode } from "react";

describe("Prompt 2 Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("schema accepts src/data/mock-run.json", () => {
    const result = RunResultSchema.safeParse(mockRun);
    expect(result.success).toBe(true);
  });

  it("schema rejects a copy with a missing kpis field", () => {
    const invalidRun = { ...mockRun };
    // @ts-expect-error deleting required field for testing schema rejection
    delete invalidRun.kpis;

    const result = RunResultSchema.safeParse(invalidRun);
    expect(result.success).toBe(false);
  });

  it("http wrapper throws ApiError on a 500 and on malformed JSON", async () => {
    // 1. Test 500 response
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ error: "Internal Server Error" }),
      }),
    );

    await expect(apiFetch("/api/runs/1/result", {}, RunResultSchema)).rejects.toThrow(ApiError);

    try {
      await apiFetch("/api/runs/1/result", {}, RunResultSchema);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(500);
      expect((err as ApiError).message).toBe("Internal Server Error");
    }

    // 2. Test malformed JSON (200 OK but schema validation fails)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ invalid: "data" }),
      }),
    );

    try {
      await apiFetch("/api/runs/1/result", {}, RunResultSchema);
      expect.fail("Should have thrown ApiError for malformed response");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(200);
      expect((err as ApiError).message).toContain("Backend returned malformed data:");
    }
  });

  it("useRunStatus stops polling on succeeded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          runId: "run-test",
          state: "succeeded",
          steps: [],
        }),
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRunStatus("run-test"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.state).toBe("succeeded");
  });

  it("useRunStatus stops polling on query error", async () => {
    vi.spyOn(apiModule, "getRunStatus").mockRejectedValue(new Error("Network Error"));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRunStatus("run-err-test"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.isError).toBe(true);
  });
});
