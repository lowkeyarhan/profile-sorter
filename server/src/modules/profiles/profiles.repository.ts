// Profiles repository: the only class that talks to the profile "database"
// (data/profiles.json). Filtering lives in search.service.
import fs from "fs";
import path from "path";
import { Catalog, Profile } from "./profiles.model";

export class ProfilesRepository {
  private profiles: Profile[];

  constructor(jsonPath: string) {
    const raw = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), jsonPath), "utf8"),
    );
    if (!Array.isArray(raw)) throw new Error("profiles.json must be an array");
    for (const pr of raw) {
      if (
        !pr.id ||
        !Array.isArray(pr.skills) ||
        typeof pr.years_experience !== "number"
      )
        throw new Error(`invalid profile: ${JSON.stringify(pr.id)}`);
    }
    this.profiles = raw as Profile[];
  }

  all(): Profile[] {
    return this.profiles;
  }

  catalog(): Catalog {
    const skills = new Set<string>();
    const locations = new Set<string>();
    const types = new Set<string>();
    let minYears = Infinity;
    let maxYears = -Infinity;
    for (const p of this.profiles) {
      p.skills.forEach((s) => skills.add(s));
      locations.add(p.location);
      types.add(p.current_company_type);
      p.past_companies.forEach((c) => types.add(c.company_type));
      minYears = Math.min(minYears, p.years_experience);
      maxYears = Math.max(maxYears, p.years_experience);
    }
    return {
      skills: [...skills].sort(),
      locations: [...locations].sort(),
      companyTypes: [...types].sort(),
      minYears,
      maxYears,
    };
  }
}
