import Constants from "expo-constants";
import type {
  AnalyzeResponse,
  ApiError as ApiErrorBody,
  BriefRequest,
  DesignBrief,
  ImageUpload,
  IntakeRequest,
  IntakeResponse,
} from "@home-kit/shared";

const DEV_SERVER_PORT = 3000;

/**
 * Where the backend lives. Production sets EXPO_PUBLIC_API_URL. In development, the host of the
 * Expo dev server is also where the API runs, which makes real phones on the same Wi-Fi work
 * without any configuration.
 */
function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081"
  const host = hostUri?.split(":")[0];
  return `http://${host || "localhost"}:${DEV_SERVER_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // Non-JSON body (e.g. a proxy error page); handled below.
    }

    if (!res.ok) {
      const err = (json as ApiErrorBody | null)?.error;
      throw new ApiRequestError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status}).`);
    }
    return json as T;
  } catch (e) {
    if (e instanceof ApiRequestError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiRequestError(0, "timeout", "This is taking longer than expected. Please try again.");
    }
    throw new ApiRequestError(0, "network", "Can't reach the design server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

/** Message safe to show a user for any thrown value. */
export function errorMessage(e: unknown): string {
  return e instanceof ApiRequestError ? e.message : "Something went wrong. Please try again.";
}

export const api = {
  analyzeRoom: (image: ImageUpload) =>
    post<AnalyzeResponse>("/api/room/analyze", { image }, 90_000),
  intake: (req: IntakeRequest) => post<IntakeResponse>("/api/intake", req, 60_000),
  // Two sequential model calls plus catalog lookups; give it room.
  brief: (req: BriefRequest) => post<DesignBrief>("/api/brief", req, 180_000),
};
