// Scoring DTO: strict class for the LLM scoring reply.
import { numRange, reqArr, reqObj, reqStr } from "../../validation";

export interface ScoreEntry {
  profileId: string;
  criteria: { id: string; score: number }[];
  explanation: string;
  citations: { field: string; value: string }[];
}

export class ScoreBatchBody {
  constructor(public scores: ScoreEntry[]) {}

  static parse(data: any): ScoreBatchBody {
    const o = reqObj(data, "scores");
    const scores = reqArr(o.scores, "scores").map((s, i) => {
      const so = reqObj(s, `scores[${i}]`);
      const criteria = reqArr(so.criteria, `scores[${i}].criteria`).map((c, j) => {
        const co = reqObj(c, `scores[${i}].criteria[${j}]`);
        return {
          id: reqStr(co.id, `scores[${i}].criteria[${j}].id`),
          score: numRange(co.score, `scores[${i}].criteria[${j}].score`, 0, 10),
        };
      });
      const citations = reqArr(so.citations, `scores[${i}].citations`).map((c, j) => {
        const co = reqObj(c, `scores[${i}].citations[${j}]`);
        return {
          field: reqStr(co.field, `scores[${i}].citations[${j}].field`),
          value: reqStr(co.value, `scores[${i}].citations[${j}].value`),
        };
      });
      return {
        profileId: reqStr(so.profileId, `scores[${i}].profileId`),
        criteria,
        explanation: reqStr(so.explanation, `scores[${i}].explanation`),
        citations,
      };
    });
    return new ScoreBatchBody(scores);
  }
}
