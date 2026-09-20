export interface SkillTerm {
  name: string;
  aliases: string[];
}

export interface Filters {
  skills: { allOf: SkillTerm[]; anyOf: SkillTerm[] };
  experience: { minYears: number | null; maxYears: number | null };
  locations: string[];
  companyBackground: { types: string[]; scope: "any" | "current" };
}

export interface RubricCriterion {
  id: string;
  label: string;
  description: string;
  weight: number;
}

export interface Rubric {
  roleSummary: string;
  criteria: RubricCriterion[];
}
