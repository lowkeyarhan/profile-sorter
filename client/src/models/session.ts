import type { Filters, Rubric } from "./criteria";
import type { Profile } from "./profile";

export interface Citation {
  field: string;
  value: string;
}

export interface CriterionScore {
  id: string;
  score: number;
}

export interface ScoredItem {
  profile: Profile;
  score: number;
  criterionScores: CriterionScore[];
  explanation: string;
  citations: Citation[];
}

export interface Reaction {
  profileId: string;
  verdict: "match" | "no_match";
}

export interface CreateSessionResult {
  sessionId: string;
  filters: Filters;
  rubric: Rubric;
  assumptions: string[];
}

export interface SearchResult {
  totalProfiles: number;
  matchedCount: number;
  shown: ScoredItem[];
  shortlist: ScoredItem[];
  exhausted: boolean;
  hint: string | null;
}

export interface FeedbackResult extends SearchResult {
  summary: string;
  changes: { what: string; why: string }[];
  interpretations: { reaction: string; meaning: string }[];
  clarification: string | null;
  filters: Filters;
  rubric: Rubric;
}

export interface FreezeResult {
  filters: Filters;
  rubric: Rubric;
  shortlist: ScoredItem[];
  otherMatches: ScoredItem[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
  retryable: boolean;
}
