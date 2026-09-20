import { randomUUID } from "crypto";
import { fail } from "../../errors";
import { FaultOpts } from "../../llm/openai.client";
import { CriteriaService } from "../criteria/criteria.service";
import { Filters } from "../criteria/criteria.model";
import { Profile } from "../profiles/profiles.model";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { RefinementService } from "../refinement/refinement.service";
import { ScoringService } from "../scoring/scoring.service";
import { ScoredProfile } from "../scoring/scoring.model";
import { SearchService } from "../search/search.service";
import { Session } from "./sessions.model";
import { SessionsRepository } from "./sessions.repository";
import {
  CreateSessionDto,
  FeedbackBody,
  FeedbackResultDto,
  FreezeResultDto,
  ScoredItemDto,
  SearchBody,
  SearchResultDto,
} from "./sessions.dto";

export class SessionsService {
  constructor(
    private profiles: ProfilesRepository,
    private sessions: SessionsRepository,
    private searchService: SearchService,
    private criteria: CriteriaService,
    private scoring: ScoringService,
    private refinement: RefinementService,
  ) {}

  private need(id: string): Session {
    const s = this.sessions.get(id);
    if (!s) throw fail("SESSION_NOT_FOUND", "session not found");
    if (s.frozen) throw fail("SESSION_FROZEN", "session is frozen");
    return s;
  }

  private show(
    byId: Map<string, Profile>,
    s: Session,
    r: ScoredProfile,
  ): ScoredItemDto {
    return {
      profile: byId.get(r.profileId)!,
      score: r.score,
      criterionScores: r.criterionScores,
      explanation: r.explanation,
      citations: r.citations,
    };
  }

  private cacheKey(s: Session, id: string): string {
    return `${JSON.stringify(s.rubric)}|${id}`;
  }

  // Suggests which filter to relax when nothing matches.
  private hint(f: Filters): string | null {
    const all = this.profiles.all();
    if (this.searchService.applyFilters(all, f).length > 0) return null;
    const empty: Filters = {
      skills: { allOf: [], anyOf: [] },
      experience: { minYears: null, maxYears: null },
      locations: [],
      companyBackground: { types: [], scope: "any" },
    };
    const drops: [string, Filters][] = [
      ["skills", { ...f, skills: empty.skills }],
      ["experience", { ...f, experience: empty.experience }],
      ["locations", { ...f, locations: empty.locations }],
      [
        "companyBackground",
        { ...f, companyBackground: empty.companyBackground },
      ],
    ];
    let best: [string, number] = ["", -1];
    for (const [label, v] of drops) {
      const n = this.searchService.applyFilters(all, v).length;
      if (n > best[1]) best = [label, n];
    }
    return best[1] > 0
      ? `No matches. Try relaxing '${best[0]}' — removing it matches ${best[1]} profiles.`
      : "No matches. Try clearing the filters.";
  }

  // One round: filter, score, and show the next 5 unreviewed profiles.
  private async round(s: Session, fault: FaultOpts) {
    const all = this.profiles.all();
    const byId = new Map(all.map((p) => [p.id, p]));
    const matched = this.searchService.applyFilters(all, s.filters);
    const ranked =
      matched.length > 0
        ? await this.scoring.scoreProfiles(matched, s.rubric, s.scores, fault)
        : [];
    const missing = s.shortlist
      .filter((id) => !s.scores.has(this.cacheKey(s, id)))
      .map((id) => byId.get(id)!)
      .filter(Boolean);
    if (missing.length > 0)
      await this.scoring.scoreProfiles(missing, s.rubric, s.scores, fault);
    const pool = ranked.filter(
      (r) => !s.decisions.has(r.profileId) && !s.seenIds.includes(r.profileId),
    );
    const shown = pool.slice(0, 5);
    s.seenIds.push(...shown.map((x) => x.profileId));
    s.lastShown = shown.map((x) => x.profileId);
    return {
      matchedCount: matched.length,
      shown: shown.map((x) => this.show(byId, s, x)),
      shortlist: s.shortlist
        .map((id) => this.show(byId, s, s.scores.get(this.cacheKey(s, id))!))
        .filter((x) => x.profile),
      exhausted: pool.length <= 5,
      hint: this.hint(s.filters),
    };
  }

  catalog() {
    return this.profiles.catalog();
  }

  async create(query: string, fault: FaultOpts): Promise<CreateSessionDto> {
    if (!query?.trim()) throw fail("VALIDATION_ERROR", "query is required");
    const { filters, rubric, assumptions } =
      await this.criteria.generateCriteria(
        query,
        this.profiles.catalog(),
        fault,
      );
    const s = new Session(randomUUID(), query, filters, rubric, assumptions);
    this.sessions.save(s);
    return { sessionId: s.id, filters, rubric, assumptions };
  }

  async search(
    id: string,
    body: SearchBody,
    fault: FaultOpts,
  ): Promise<SearchResultDto> {
    const s = this.need(id);
    const snap = s.snapshot();
    if (body.filters) s.filters = body.filters;
    if (body.rubric) s.rubric = body.rubric;
    try {
      return {
        totalProfiles: this.profiles.all().length,
        ...(await this.round(s, fault)),
      };
    } catch (e) {
      s.filters = snap.filters;
      s.rubric = snap.rubric;
      throw e;
    }
  }

  async feedback(
    id: string,
    body: FeedbackBody,
    fault: FaultOpts,
  ): Promise<FeedbackResultDto> {
    const s = this.need(id);
    if (!body.message && !body.reactions?.length)
      throw fail("VALIDATION_ERROR", "message or reactions required");
    const byId = new Map(this.profiles.all().map((p) => [p.id, p]));
    for (const r of body.reactions ?? []) {
      if (!byId.has(r.profileId))
        throw fail("VALIDATION_ERROR", `unknown profileId ${r.profileId}`);
    }
    // Snapshot everything so a failed LLM call leaves the session untouched.
    const snap = s.snapshot();
    try {
      for (const r of body.reactions ?? []) {
        s.decisions.set(r.profileId, r.verdict as "match" | "no_match");
        if (r.verdict === "match" && !s.shortlist.includes(r.profileId))
          s.shortlist.push(r.profileId);
      }
      if (body.message) s.history.push(body.message);
      const out = await this.refinement.refineCriteria(
        {
          filters: s.filters,
          rubric: s.rubric,
          shown: s.lastShown.map((pid, i) => ({
            position: i + 1,
            profile: byId.get(pid)!,
          })),
          message: body.message,
          reactions: body.reactions,
          history: s.history.slice(0, -1),
        },
        fault,
      );
      if (out.clarification == null) {
        s.filters = out.filters;
        s.rubric = out.rubric;
      }
      return {
        totalProfiles: this.profiles.all().length,
        summary: out.summary,
        changes: out.changes,
        interpretations: out.interpretations,
        clarification: out.clarification,
        filters: s.filters,
        rubric: s.rubric,
        ...(await this.round(s, fault)),
      };
    } catch (e) {
      s.restore(snap);
      throw e;
    }
  }

  async freeze(id: string, fault: FaultOpts): Promise<FreezeResultDto> {
    const s = this.sessions.get(id);
    if (!s) throw fail("SESSION_NOT_FOUND", "session not found");
    if (s.frozen) throw fail("SESSION_FROZEN", "session is frozen");
    const all = this.profiles.all();
    const byId = new Map(all.map((p) => [p.id, p]));
    const matched = this.searchService.applyFilters(all, s.filters);
    const ranked =
      matched.length > 0
        ? await this.scoring.scoreProfiles(matched, s.rubric, s.scores, fault)
        : [];
    const missing = s.shortlist
      .filter((pid) => !s.scores.has(this.cacheKey(s, pid)))
      .map((pid) => byId.get(pid))
      .filter((p): p is Profile => !!p);
    if (missing.length > 0)
      await this.scoring.scoreProfiles(missing, s.rubric, s.scores, fault);
    s.frozen = true;
    return {
      filters: s.filters,
      rubric: s.rubric,
      shortlist: s.shortlist
        .map((pid) => this.show(byId, s, s.scores.get(this.cacheKey(s, pid))!))
        .filter((x) => x.profile),
      otherMatches: ranked
        .filter((r) => !s.decisions.has(r.profileId))
        .map((r) => this.show(byId, s, r)),
    };
  }
}
