// Search service: the filtering business logic. Pure methods, no LLM.
import { Filters, SkillTerm } from "../criteria/criteria.model";
import { Profile } from "../profiles/profiles.model";

export class SearchService {
  // Whole-word tokens, so "Java" never matches "JavaScript".
  private tok(s: string): string[] {
    return s
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/g)
      .filter(Boolean);
  }

  skillMatches(have: string[], term: SkillTerm): boolean {
    const h = have.flatMap((s) => this.tok(s));
    return [term.name, ...term.aliases].some((variant) =>
      this.tok(variant).every(
        (t) => h.includes(t) || h.some((x) => x.split(".").includes(t)),
      ),
    );
  }

  // Empty filter values mean "no constraint".
  applyFilters(profiles: Profile[], f: Filters): Profile[] {
    const locs = new Set(f.locations.map((l) => l.toLowerCase()));
    const types = new Set(
      f.companyBackground.types.map((t) => t.toLowerCase()),
    );
    return profiles.filter((p) => {
      if (
        f.experience.minYears != null &&
        p.years_experience < f.experience.minYears
      )
        return false;
      if (
        f.experience.maxYears != null &&
        p.years_experience > f.experience.maxYears
      )
        return false;
      if (locs.size > 0 && !locs.has(p.location.toLowerCase())) return false;
      if (!f.skills.allOf.every((t) => this.skillMatches(p.skills, t)))
        return false;
      if (
        f.skills.anyOf.length > 0 &&
        !f.skills.anyOf.some((t) => this.skillMatches(p.skills, t))
      )
        return false;
      if (types.size > 0) {
        const current = types.has(p.current_company_type.toLowerCase());
        if (f.companyBackground.scope === "current") {
          if (!current) return false;
        } else if (
          !current &&
          !p.past_companies.some((c) => types.has(c.company_type.toLowerCase()))
        ) {
          return false;
        }
      }
      return true;
    });
  }
}
