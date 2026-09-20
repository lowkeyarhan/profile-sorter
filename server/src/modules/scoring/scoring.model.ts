// Scoring model: the shapes of scores. Plain interfaces only.
export interface CriterionScore {
  id: string;
  score: number;
}

export interface Citation {
  field: string;
  value: string;
}

export interface ScoredProfile {
  profileId: string;
  score: number;
  criterionScores: CriterionScore[];
  explanation: string;
  citations: Citation[];
}
