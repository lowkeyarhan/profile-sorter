// Refinement service: LLM call 3. Updates filters + rubric from feedback.
import { FaultOpts, OpenAIClient } from "../../llm/openai.client";
import { loadPrompt } from "../../llm/prompts";
import { RefinementBody } from "./refinement.dto";
import { RefineInput, Refinement } from "./refinement.model";

export class RefinementService {
  constructor(private llm: OpenAIClient) {}

  async refineCriteria(
    input: RefineInput,
    opts: FaultOpts = {},
  ): Promise<Refinement> {
    const prompt = loadPrompt("refine-criteria", {
      filters: JSON.stringify(input.filters),
      rubric: JSON.stringify(input.rubric),
      shown: JSON.stringify(input.shown),
      feedback: JSON.stringify({
        message: input.message ?? null,
        reactions: input.reactions ?? [],
      }),
      history: JSON.stringify(input.history),
    });
    return this.llm.completeJson(RefinementBody.parse, { ...prompt, ...opts });
  }
}
