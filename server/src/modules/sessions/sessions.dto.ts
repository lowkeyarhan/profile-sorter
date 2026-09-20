// Sessions DTO: strict classes for the request bodies, plain shapes for responses.
import { must, optStr, reqObj, reqStr } from "../../validation";
import { FiltersBody, RubricBody } from "../criteria/criteria.dto";
import { Filters, Rubric } from "../criteria/criteria.model";
import { Profile } from "../profiles/profiles.model";
import { Citation, CriterionScore } from "../scoring/scoring.model";

export class SearchBody {
  constructor(
    public filters?: Filters,
    public rubric?: Rubric,
  ) {}

  static parse(data: any): SearchBody {
    const o = reqObj(data, "body");
    return new SearchBody(
      o.filters === undefined ? undefined : FiltersBody.parse(o.filters),
      o.rubric === undefined ? undefined : RubricBody.parse(o.rubric),
    );
  }
}

export class ReactionBody {
  constructor(
    public profileId: string,
    public verdict: "match" | "no_match",
  ) {}

  static parse(data: any, field: string): ReactionBody {
    const o = reqObj(data, field);
    const verdict = reqStr(o.verdict, `${field}.verdict`);
    must(
      verdict === "match" || verdict === "no_match",
      `${field}.verdict`,
      'must be "match" or "no_match"',
    );
    return new ReactionBody(
      reqStr(o.profileId, `${field}.profileId`),
      verdict as "match" | "no_match",
    );
  }
}

export class FeedbackBody {
  constructor(
    public message?: string,
    public reactions?: ReactionBody[],
  ) {}

  static parse(data: any): FeedbackBody {
    const o = reqObj(data, "body");
    must(
      o.reactions === undefined || Array.isArray(o.reactions),
      "reactions",
      "must be an array",
    );
    const reactions =
      o.reactions === undefined
        ? undefined
        : o.reactions.map((r: any, i: number) =>
            ReactionBody.parse(r, `reactions[${i}]`),
          );
    return new FeedbackBody(optStr(o.message, "message"), reactions);
  }
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
