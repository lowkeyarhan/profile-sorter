import { send } from "./http";
import { ApiError } from "./http";
import type {
  CreateSessionResult,
  FeedbackResult,
  FreezeResult,
  SearchResult,
} from "../models/session";
import type { Filters, Rubric } from "../models/criteria";
import type { Reaction } from "../models/session";

export async function createSession(
  query: string,
): Promise<CreateSessionResult> {
  try {
    return await send<CreateSessionResult>("/api/sessions", "POST", { query });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError({
      code: "INTERNAL_ERROR",
      message: "Failed to create session",
      retryable: true,
    });
  }
}

export async function searchSession(
  id: string,
  filters?: Filters,
  rubric?: Rubric,
): Promise<SearchResult> {
  try {
    return await send<SearchResult>(`/api/sessions/${id}/search`, "POST", {
      filters,
      rubric,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError({
      code: "INTERNAL_ERROR",
      message: "Failed to search",
      retryable: true,
    });
  }
}

export async function sendFeedback(
  id: string,
  message: string | undefined,
  reactions: Reaction[],
): Promise<FeedbackResult> {
  try {
    return await send<FeedbackResult>(`/api/sessions/${id}/feedback`, "POST", {
      message,
      reactions,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError({
      code: "INTERNAL_ERROR",
      message: "Failed to send feedback",
      retryable: true,
    });
  }
}

export async function freezeSession(id: string): Promise<FreezeResult> {
  try {
    return await send<FreezeResult>(`/api/sessions/${id}/freeze`, "POST");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError({
      code: "INTERNAL_ERROR",
      message: "Failed to freeze",
      retryable: true,
    });
  }
}
