// Session model: one search session. A plain class, like a Java entity.
// The conversation history lives in `history`; everything is held in memory.
import { Filters, Rubric } from "../criteria/criteria.model";
import { ScoredProfile } from "../scoring/scoring.model";

export interface SessionSnapshot {
  filters: Filters;
  rubric: Rubric;
  decisions: Map<string, "match" | "no_match">;
  shortlist: string[];
  seenIds: string[];
  lastShown: string[];
  history: string[];
}

export class Session {
  seenIds: string[] = [];
  lastShown: string[] = [];
  decisions = new Map<string, "match" | "no_match">();
  shortlist: string[] = [];
  frozen = false;
  history: string[] = [];
  scores = new Map<string, ScoredProfile>();

  constructor(
    public id: string,
    public query: string,
    public filters: Filters,
    public rubric: Rubric,
    public assumptions: string[],
  ) {}

  snapshot(): SessionSnapshot {
    return {
      filters: this.filters,
      rubric: this.rubric,
      decisions: new Map(this.decisions),
      shortlist: [...this.shortlist],
      seenIds: [...this.seenIds],
      lastShown: [...this.lastShown],
      history: [...this.history],
    };
  }

  restore(snap: SessionSnapshot): void {
    this.filters = snap.filters;
    this.rubric = snap.rubric;
    this.decisions = snap.decisions;
    this.shortlist = snap.shortlist;
    this.seenIds = snap.seenIds;
    this.lastShown = snap.lastShown;
    this.history = snap.history;
  }
}
