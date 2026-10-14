import { z } from "zod";

export class ApiError extends Error {
  status: number;
  zodIssues?: z.ZodIssue[];

  constructor(status: number, message: string, zodIssues?: z.ZodIssue[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (zodIssues !== undefined) {
      this.zodIssues = zodIssues;
    }
  }
}

export function getBaseUrl(): string {
  const url = import.meta.env["VITE_API_URL"];
  if (!url || typeof url !== "string") return "";
  return url.trim().replace(/\/+$/, "");
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  schema?: z.ZodSchema<T>,
  timeoutMs = 15000,
): Promise<T> {
  const baseUrl = getBaseUrl();
  const fullUrl =
    endpoint.startsWith("http://") || endpoint.startsWith("https://")
      ? endpoint
      : `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        504,
        `Request timed out after ${timeoutMs}ms calling ${baseUrl || fullUrl}`,
      );
    }
    const host = baseUrl || fullUrl;
    throw new ApiError(0, `Cannot reach the analysis server at ${host}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorJson = await response.json();
      if (errorJson && typeof errorJson === "object") {
        errorMessage =
          errorJson.error || errorJson.detail || errorJson.message || response.statusText;
      }
    } catch {
      // Use statusText if body is not JSON
    }
    throw new ApiError(response.status, errorMessage);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(response.status, "Backend returned invalid JSON response.");
  }

  if (schema) {
    const parseResult = schema.safeParse(data);
    if (!parseResult.success) {
      const issues = parseResult.error.issues;
      const issueSummary = issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
        .join("; ");
      throw new ApiError(
        response.status,
        `Backend returned malformed data: ${issueSummary}`,
        issues,
      );
    }
    return parseResult.data;
  }

  return data as T;
}
