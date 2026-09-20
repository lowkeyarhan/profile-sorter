import { send } from "./http";
import { ApiError } from "./http";
import type { Catalog } from "../models/profile";

export async function getCatalog(): Promise<Catalog> {
  try {
    return await send<Catalog>("/api/catalog", "GET");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError({
      code: "INTERNAL_ERROR",
      message: "Failed to load catalog",
      retryable: true,
    });
  }
}
