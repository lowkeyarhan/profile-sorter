import type { SearchResult } from "../models/session";
import { ProfileCard } from "./ProfileCard";

interface Props {
  result: SearchResult;
  loading: boolean;
  onVerdict: (profileId: string, verdict: "match" | "no_match") => void;
  reactions: Record<string, "match" | "no_match">;
}

export function Results({ result, loading, onVerdict, reactions }: Props) {
  return (
    <div>
      <div className="results-header">
        <div className="count">
          {result.matchedCount} of {result.totalProfiles} matched · showing{" "}
          {result.shown.length}
          {result.exhausted ? " (exhausted)" : ""}
        </div>
        {result.hint && (
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            {result.hint}
          </div>
        )}
      </div>

      {loading && <div className="loading">Searching</div>}

      {!loading &&
        result.shown.map((item, i) => (
          <ProfileCard
            key={item.profile.id}
            item={item}
            position={i + 1}
            verdict={reactions[item.profile.id]}
            onVerdict={onVerdict}
          />
        ))}

      {!loading && result.shown.length === 0 && (
        <div className="loading">No matches found. Try a different query.</div>
      )}

      {result.shortlist.length > 0 && (
        <div className="shortlist-summary">
          <span>{result.shortlist.length}</span> shortlisted
        </div>
      )}
    </div>
  );
}
