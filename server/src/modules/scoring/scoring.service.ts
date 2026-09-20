// Scoring service: LLM call 2. Scores profiles, checks citations,
// does the weighted math, ranks, and caches. The LLM never ranks.
import { FaultOpts, OpenAIClient } from "../../llm/openai.client";
import { loadPrompt } from "../../llm/prompts";
import { Rubric } from "../criteria/criteria.model";
import { Profile } from "../profiles/profiles.model";
import { ScoreBatchBody } from "./scoring.dto";
import { Citation, CriterionScore, ScoredProfile } from "./scoring.model";

export class ScoringService {
  constructor(private llm: OpenAIClient) {}

  private overallScore(scores: CriterionScore[], rubric: Rubric): number {
    let got = 0;
    let total = 0;
    for (const c of rubric.criteria) {
      const s = scores.find((x) => x.id === c.id)?.score ?? 0;
      got += c.weight * (Math.min(10, Math.max(0, s)) / 10);
      total += c.weight;
    }
    return Math.round(((100 * got) / (total || 1)) * 10) / 10;
  }

  private isRealCitation(profile: Profile, c: Citation): boolean {
    const v: any = (profile as any)[c.field];
    if (v == null) return false;
    const text = Array.isArray(v)
      ? v.map((i) => (typeof i === "object" ? JSON.stringify(i) : String(i))).join(" ")
      : typeof v === "object" ? JSON.stringify(v) : String(v);
    return text.includes(c.value);
  }

  private fallbackFor(profile: Profile): { explanation: string; citations: Citation[] } {
    return {
      explanation: `${profile.name}, ${profile.current_title} with ${profile.years_experience} years in ${profile.location}; skills include ${profile.skills.slice(0, 3).join(", ")}.`,
      citations: [
        { field: "current_title", value: profile.current_title },
        { field: "skills", value: profile.skills[0] ?? "" },
      ].filter((c) => c.value),
    };
  }

  async scoreProfiles(
    profiles: Profile[],
    rubric: Rubric,
    cache: Map<string, ScoredProfile>,
    opts: FaultOpts = {}
  ): Promise<ScoredProfile[]> {
    const key = (id: string): string => `${JSON.stringify(rubric)}|${id}`;
    const out: ScoredProfile[] = [];

    for (let i = 0; i < profiles.length; i += 12) {
      const fresh = profiles.slice(i, i + 12).filter((p) => !cache.has(key(p.id)));
      if (fresh.length > 0) {
        const prompt = loadPrompt("score-profiles", {
          rubric: JSON.stringify(rubric),
          profiles: JSON.stringify(fresh),
        });
        const res = await this.llm.completeJson(ScoreBatchBody.parse, { ...prompt, ...opts });
        for (const p of fresh) {
          const one = res.scores.find((x) => x.profileId === p.id);
          const criterionScores = rubric.criteria.map((c) => ({
            id: c.id,
            score: one?.criteria.find((x) => x.id === c.id)?.score ?? 0,
          }));
          const good = (one?.citations ?? []).filter((c) => this.isRealCitation(p, c));
          const plain = good.length < 2 ? this.fallbackFor(p) : null;
          cache.set(key(p.id), {
            profileId: p.id,
            score: this.overallScore(criterionScores, rubric),
            criterionScores,
            explanation: plain?.explanation ?? one!.explanation,
            citations: plain?.citations ?? good,
          });
        }
      }
      for (const p of profiles.slice(i, i + 12)) out.push(cache.get(key(p.id))!);
    }

    return out.sort((a, b) => b.score - a.score || (a.profileId < b.profileId ? -1 : 1));
  }
}
