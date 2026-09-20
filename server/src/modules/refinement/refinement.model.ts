// Refinement model: the shapes of a refinement. Plain interfaces only.
import { Filters, Rubric } from "../criteria/criteria.model";
import { Profile } from "../profiles/profiles.model";

export interface RefineInput {
  filters: Filters;
  rubric: Rubric;
  shown: { position: number; profile: Profile }[];
  message?: string;
  reactions?: { profileId: string; verdict: string }[];
  history: string[];
}

export interface Refinement {
  filters: Filters;
  rubric: Rubric;
  interpretations: { reaction: string; meaning: string }[];
  summary: string;
  changes: { what: string; why: string }[];
  clarification: string | null;
}
