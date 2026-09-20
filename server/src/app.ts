import cors from "cors";
import express from "express";

const STATUS: Record<string, number> = {
  VALIDATION_ERROR: 400,
  SESSION_NOT_FOUND: 404,
  SESSION_FROZEN: 409,
  LLM_RATE_LIMITED: 429,
  LLM_UNAVAILABLE: 502,
  LLM_BAD_OUTPUT: 502,
  LLM_TIMEOUT: 504,
};

export const errorToStatus = (code: string): number => STATUS[code] ?? 500;

export function createApp(): express.Express {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_URL || true }));
  app.use(express.json());
  return app;
}

export function errorHandler(e: any, _req: any, res: any, _next: any): void {
  const code = e.code ?? "INTERNAL_ERROR";
  res.status(errorToStatus(code)).json({
    error: {
      code,
      message: e.message ?? "internal error",
      retryable: !!e.retryable,
    },
  });
}
