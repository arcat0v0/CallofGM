import { getFingerprint } from "./fingerprint";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function mediaUrl(assetId: string | null | undefined): string | null {
  if (!assetId) {
    return null;
  }
  return `/api/v1/media/${encodeURIComponent(assetId)}`;
}

export function unwrapItems<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: T[] }).items;
  }
  return [];
}

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { code?: string; message?: string };
    return new ApiError(response.status, body.code ?? "ERROR", body.message ?? response.statusText);
  } catch {
    return new ApiError(response.status, "ERROR", response.statusText);
  }
}

function normalizePath(path: string): string {
  if (path.startsWith("/api/")) {
    return path;
  }
  return `/api/v1${path.startsWith("/") ? path : `/${path}`}`;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const fingerprint = await getFingerprint();
  const headers = new Headers(init.headers);
  headers.set("X-Fingerprint", fingerprint);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(normalizePath(path), {
    credentials: "include",
    ...init,
    headers,
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function fetchAllPages<T>(path: string, init?: RequestInit): Promise<T[]> {
  const queryIndex = path.indexOf("?");
  const pathname = queryIndex >= 0 ? path.slice(0, queryIndex) : path;
  const params = new URLSearchParams(queryIndex >= 0 ? path.slice(queryIndex + 1) : "");
  params.set("limit", "100");
  params.delete("cursor");

  const collected: T[] = [];
  for (;;) {
    const page = await api<CursorPage<T> | T[]>(`${pathname}?${params.toString()}`, init);
    if (Array.isArray(page)) {
      collected.push(...page);
      break;
    }
    if (!page || !Array.isArray(page.items)) {
      break;
    }
    collected.push(...page.items);
    if (!page.nextCursor || page.nextCursor === params.get("cursor")) {
      break;
    }
    params.set("cursor", page.nextCursor);
  }
  return collected;
}
