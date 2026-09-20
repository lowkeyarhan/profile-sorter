// Criteria DTO: validation for the filter/rubric bodies (LLM call 1 output,
// recruiter-edited search input). The service imports these to validate.
import { z } from "zod";

export const SkillTermDto = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
});

export const FiltersDto = z.object({
  skills: z.object({
    allOf: z.array(SkillTermDto),
    anyOf: z.array(SkillTermDto),
  }),
  experience: z.object({
    minYears: z.number().nullable(),
    maxYears: z.number().nullable(),
  }),
  locations: z.array(z.string()),
  companyBackground: z.object({
    types: z.array(z.string()),
    scope: z.enum(["any", "current"]),
  }),
});

export const RubricDto = z.object({
  roleSummary: z.string(),
  criteria: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string(),
        weight: z.number().int().min(1).max(5),
      }),
    )
    .min(3)
    .max(6),
});

export const CriteriaOutputDto = z.object({
  filters: FiltersDto,
  rubric: RubricDto,
  assumptions: z.array(z.string()),
});
