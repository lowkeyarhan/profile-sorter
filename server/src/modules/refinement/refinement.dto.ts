// Refinement DTO: validation for the LLM refinement reply (LLM call 3 output).
import { z } from "zod";
import { FiltersDto, RubricDto } from "../criteria/criteria.dto";

export const RefinementDto = z.object({
  filters: FiltersDto,
  rubric: RubricDto,
  interpretations: z.array(
    z.object({ reaction: z.string(), meaning: z.string() }),
  ),
  summary: z.string(),
  changes: z.array(z.object({ what: z.string(), why: z.string() })),
  clarification: z.string().nullable(),
});
