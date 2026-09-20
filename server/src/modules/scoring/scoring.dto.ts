// Scoring DTO: validation for the LLM scoring reply (LLM call 2 output).
import { z } from "zod";

export const ScoreBatchDto = z.object({
  scores: z.array(
    z.object({
      profileId: z.string(),
      criteria: z.array(
        z.object({ id: z.string(), score: z.number().min(0).max(10) }),
      ),
      explanation: z.string(),
      citations: z.array(z.object({ field: z.string(), value: z.string() })),
    }),
  ),
});
