import type { ApiErrorBody } from "../models/session";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

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
