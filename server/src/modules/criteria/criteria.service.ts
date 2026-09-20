// Criteria service: LLM call 1. Turns a free-text query into filters + rubric.
import { FaultOpts, OpenAIClient } from "../../llm/openai.client";
import { loadPrompt } from "../../llm/prompts";
import { Catalog } from "../profiles/profiles.model";
import { CriteriaBody } from "./criteria.dto";
import { Filters, Rubric } from "./criteria.model";

export class CriteriaService {
  constructor(private llm: OpenAIClient) {}

  async generateCriteria(
    query: string,
    catalog: Catalog,
    opts: FaultOpts = {},
  ): Promise<{ filters: Filters; rubric: Rubric; assumptions: string[] }> {
    const prompt = loadPrompt("generate-criteria", {
      query,
      vocabulary: JSON.stringify(catalog),
    });
    return this.llm.completeJson(CriteriaBody.parse, { ...prompt, ...opts });
  }
}
