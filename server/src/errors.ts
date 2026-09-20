// Simple app errors. Controllers throw these with fail(); only app.ts turns them into HTTP statuses.
export interface AppError extends Error {
  code: string;
  retryable: boolean;
}

export const fail = (
  code: string,
  message: string,
  retryable = false,
): AppError => Object.assign(new Error(message), { code, retryable });

// Decorator: wraps a route handler in try/catch so thrown errors reach the error middleware.
export const catchErrors =
  (fn: (req: any, res: any) => Promise<void>) =>
  (req: any, res: any, next: any): void => {
    fn(req, res).catch(next);
  };
