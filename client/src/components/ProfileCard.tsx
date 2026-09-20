import type { ScoredItem } from "../models/session";

interface Props {
  item: ScoredItem;
  position: number;
  verdict?: "match" | "no_match";
  onVerdict?: (id: string, v: "match" | "no_match") => void;
}

export function ProfileCard({ item, position, verdict, onVerdict }: Props) {
  const p = item.profile;

  return (
    <div className="card">
      <div className="card-top">
        <div className="card-rank">{position}</div>
        <div className="card-info">
          <h3>
            {p.name}
            <span
              style={{
                fontWeight: 400,
                color: "var(--muted)",
                fontSize: 14,
                marginLeft: 8,
              }}
            >
              {p.current_title}
            </span>
          </h3>
          <div className="meta">
            {p.location} · {p.years_experience} yrs · {p.current_company}
          </div>
          <div className="card-meta-row">
            <div className="score-badge">{item.score}</div>
            {p.skills.slice(0, 4).map((s) => (
              <span className="chip" key={s}>
                {s}
              </span>
            ))}
          </div>
          <div className="criterion-scores">
            {item.criterionScores.map((cs) => (
              <span className="criterion-score-mini" key={cs.id}>
                {cs.id}: {cs.score}/10
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="explanation">{item.explanation}</div>
      {item.citations.map((c, i) => (
        <div className="citation" key={i}>
          · {c.field}: <strong>{c.value}</strong>
        </div>
      ))}

      {onVerdict && (
        <div className="card-actions">
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onVerdict(p.id, "match")}
          >
            {verdict === "match" ? "✓ Match" : "Match"}
          </button>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => onVerdict(p.id, "no_match")}
          >
            {verdict === "no_match" ? "✗ No" : "No"}
          </button>
        </div>
      )}
    </div>
  );
}
