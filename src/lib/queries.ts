import { queryOptions, useQuery } from "@tanstack/react-query";
import { getRecentRuns, getRunResult, getRunStatus, getActiveRunId } from "./api";

export const runQuery = queryOptions({
  queryKey: ["run"],
  queryFn: () => getRunResult(getActiveRunId()),
  staleTime: Infinity,
});

export const recentRunsQuery = queryOptions({
  queryKey: ["recent"],
  queryFn: getRecentRuns,
  staleTime: Infinity,
});

export function useRunStatus(runId: string | null) {
  return useQuery({
    queryKey: ["runStatus", runId],
    queryFn: () => (runId ? getRunStatus(runId) : Promise.reject(new Error("No runId"))),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      if (query.state.status === "error") return false;
      const data = query.state.data;
      if (!data) return 1500;
      if (data.state === "queued" || data.state === "running") {
        return 1500;
      }
      return false;
    },
  });
}

export const fmtDate = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
