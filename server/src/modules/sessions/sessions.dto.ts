// Sessions DTO: validation for the request bodies, plus the response shapes.
// Controllers validate with the Dto schemas; services import them too.
import { z } from "zod";
import { FiltersDto, RubricDto } from "../criteria/criteria.dto";
import { Filters, Rubric } from "../criteria/criteria.model";
import { Profile } from "../profiles/profiles.model";
import { Citation, CriterionScore } from "../scoring/scoring.model";

export const SearchBodyDto = z.object({
  filters: FiltersDto.optional(),
  rubric: RubricDto.optional(),
});

export const FeedbackBodyDto = z.object({
  message: z.string().optional(),
  reactions: z
    .array(
      z.object({
        profileId: z.string(),
        verdict: z.enum(["match", "no_match"]),
      }),
    )
    .optional(),
});

export interface SearchBody {
  filters?: Filters;
  rubric?: Rubric;
}

export interface FeedbackBody {
  message?: string;
  reactions?: { profileId: string; verdict: string }[];
}

export interface ScoredItemDto {
  profile: Profile;
  score: number;
  criterionScores: CriterionScore[];
  explanation: string;
  citations: Citation[];
}

export interface CreateSessionDto {
  sessionId: string;
  filters: Filters;
  rubric: Rubric;
  assumptions: string[];
}

export interface SearchResultDto {
  totalProfiles: number;
  matchedCount: number;
  shown: ScoredItemDto[];
  shortlist: ScoredItemDto[];
  exhausted: boolean;
  hint: string | null;
}

export interface FeedbackResultDto extends SearchResultDto {
  summary: string;
  changes: { what: string; why: string }[];
  interpretations: { reaction: string; meaning: string }[];
  clarification: string | null;
  filters: Filters;
  rubric: Rubric;
}

export interface FreezeResultDto {
  filters: Filters;
  rubric: Rubric;
  shortlist: ScoredItemDto[];
  otherMatches: ScoredItemDto[];
}
