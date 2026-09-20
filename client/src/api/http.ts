import type { ApiErrorBody } from "../models/session";

// Always relative: the browser talks to the Vite dev server on the same
// origin, which proxies /api to the backend (see vite.config.ts). An absolute
// URL like http://server:4000 would only resolve inside Docker, never in a browser.
export const API_URL = "";

export class ApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.code = body.code;
    this.retryable = body.retryable;
  }
}

const FALLBACK: ApiErrorBody = {
  code: "INTERNAL_ERROR",
  message: "Request failed. Is the server running?",
  retryable: true,
};

export async function send<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error ?? FALLBACK);
  }

  return data as T;
}
