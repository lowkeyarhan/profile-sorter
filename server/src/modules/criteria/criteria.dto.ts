// Criteria DTO: strict classes for the filter/rubric bodies.
// Used by the controller (recruiter input) and the service (LLM output).
import {
  intRange,
  must,
  nullableNum,
  oneOf,
  reqArr,
  reqObj,
  reqStr,
} from "../../validation";
import { Filters, Rubric, SkillTerm } from "./criteria.model";

export class FiltersBody implements Filters {
  constructor(
    public skills: { allOf: SkillTerm[]; anyOf: SkillTerm[] },
    public experience: { minYears: number | null; maxYears: number | null },
    public locations: string[],
    public companyBackground: { types: string[]; scope: "any" | "current" },
  ) {}

  static parse(data: any): FiltersBody {
    const o = reqObj(data, "filters");
    const skills = reqObj(o.skills, "filters.skills");
    const experience = reqObj(o.experience, "filters.experience");
    const background = reqObj(o.companyBackground, "filters.companyBackground");
    const term = (t: any, field: string): SkillTerm => {
      const o = reqObj(t, field);
      return {
        name: reqStr(o.name, `${field}.name`),
        aliases: reqArr(o.aliases, `${field}.aliases`).map((a, i) =>
          reqStr(a, `${field}.aliases[${i}]`),
        ),
      };
    };
    return new FiltersBody(
      {
        allOf: reqArr(skills.allOf, "filters.skills.allOf").map((t, i) =>
          term(t, `filters.skills.allOf[${i}]`),
        ),
        anyOf: reqArr(skills.anyOf, "filters.skills.anyOf").map((t, i) =>
          term(t, `filters.skills.anyOf[${i}]`),
        ),
      },
      {
        minYears: nullableNum(
          experience.minYears,
          "filters.experience.minYears",
        ),
        maxYears: nullableNum(
          experience.maxYears,
          "filters.experience.maxYears",
        ),
      },
      reqArr(o.locations, "filters.locations").map((l, i) =>
        reqStr(l, `filters.locations[${i}]`),
      ),
      {
        types: reqArr(background.types, "filters.companyBackground.types").map(
          (t, i) => reqStr(t, `filters.companyBackground.types[${i}]`),
        ),
        scope: oneOf(background.scope, "filters.companyBackground.scope", [
          "any",
          "current",
        ]),
      },
    );
  }
}

export class RubricBody implements Rubric {
  constructor(
    public roleSummary: string,
    public criteria: {
      id: string;
      label: string;
      description: string;
      weight: number;
    }[],
  ) {}

  static parse(data: any): RubricBody {
    const o = reqObj(data, "rubric");
    const criteria = reqArr(o.criteria, "rubric.criteria").map((c, i) => {
      const co = reqObj(c, `rubric.criteria[${i}]`);
      return {
        id: reqStr(co.id, `rubric.criteria[${i}].id`),
        label: reqStr(co.label, `rubric.criteria[${i}].label`),
        description: reqStr(
          co.description,
          `rubric.criteria[${i}].description`,
        ),
        weight: intRange(co.weight, `rubric.criteria[${i}].weight`, 1, 5),
      };
    });
    must(
      criteria.length >= 3 && criteria.length <= 6,
      "rubric.criteria",
      "must have 3 to 6 items",
    );
    return new RubricBody(
      reqStr(o.roleSummary, "rubric.roleSummary"),
      criteria,
    );
  }
}

export class CriteriaBody {
  constructor(
    public filters: FiltersBody,
    public rubric: RubricBody,
    public assumptions: string[],
  ) {}

  static parse(data: any): CriteriaBody {
    const o = reqObj(data, "criteria");
    return new CriteriaBody(
      FiltersBody.parse(o.filters),
      RubricBody.parse(o.rubric),
      reqArr(o.assumptions, "assumptions").map((a, i) =>
        reqStr(a, `assumptions[${i}]`),
      ),
    );
  }
}
