// Refinement DTO: strict class for the LLM refinement reply.
import { anyStr, reqArr, reqObj, reqStr } from "../../validation";
import { FiltersBody, RubricBody } from "../criteria/criteria.dto";

export class RefinementBody {
  constructor(
    public filters: FiltersBody,
    public rubric: RubricBody,
    public interpretations: { reaction: string; meaning: string }[],
    public summary: string,
    public changes: { what: string; why: string }[],
    public clarification: string | null
  ) {}

  static parse(data: any): RefinementBody {
    const o = reqObj(data, "refinement");
    const clarification = o.clarification === null || o.clarification === undefined
      ? null
      : reqStr(o.clarification, "clarification");
    return new RefinementBody(
      FiltersBody.parse(o.filters),
      RubricBody.parse(o.rubric),
      reqArr(o.interpretations, "interpretations").map((t, i) => {
        const to = reqObj(t, `interpretations[${i}]`);
        return {
          reaction: reqStr(to.reaction, `interpretations[${i}].reaction`),
          meaning: reqStr(to.meaning, `interpretations[${i}].meaning`),
        };
      }),
      anyStr(o.summary, "summary"),
      reqArr(o.changes, "changes").map((c, i) => {
        const co = reqObj(c, `changes[${i}]`);
        return {
          what: reqStr(co.what, `changes[${i}].what`),
          why: reqStr(co.why, `changes[${i}].why`),
        };
      }),
      clarification
    );
  }
}
