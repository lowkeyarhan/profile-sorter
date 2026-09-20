import type { Filters, Rubric } from "../models/criteria";

interface Props {
  filters: Filters;
  rubric: Rubric;
}

function fmtYears(e: Filters["experience"]) {
  const lo = e.minYears ?? "—";
  const hi = e.maxYears ?? "—";
  return `${lo}–${hi} yrs`;
}

export function CriteriaPanel({ filters, rubric }: Props) {
  const skillNames = [
    ...filters.skills.allOf.map((s) => s.name),
    ...filters.skills.anyOf.map((s) => s.name),
  ];

  return (
    <div className="criteria-panel">
      <h3>Criteria</h3>
      <div className="criteria-grid">
        <div className="criteria-block">
          <h4>Filters</h4>
          <p><strong>Skills:</strong> {skillNames.join(", ") || "any"}</p>
          <p><strong>Experience:</strong> {fmtYears(filters.experience)}</p>
          <p>
            <strong>Locations:</strong>{" "}
            {filters.locations.length > 0 ? filters.locations.join(", ") : "any"}
          </p>
          <p>
            <strong>Company:</strong>{" "}
            {filters.companyBackground.types.join(", ") || "any"}{" "}
            ({filters.companyBackground.scope})
          </p>
        </div>
        <div className="criteria-block">
          <h4>Rubric</h4>
          <p><strong>{rubric.roleSummary}</strong></p>
          {rubric.criteria.map((c) => (
            <p key={c.id}>
              <strong>{c.label}</strong> — {c.description} (w:{c.weight})
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
