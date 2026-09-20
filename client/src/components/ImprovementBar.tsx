import type { FeedbackResult } from "../models/session";

interface Props {
  feedback: FeedbackResult;
}

export function ImprovementBar({ feedback }: Props) {
  return (
    <div className="feedback-box">
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 12,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--muted)",
        }}
      >
        Improvement
      </h3>

      {feedback.summary && (
        <div className="feedback-summary">
          <strong>Summary</strong>
          {feedback.summary}
        </div>
      )}

      {feedback.changes.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <strong style={{ fontSize: 13 }}>Changes</strong>
          {feedback.changes.map((c, i) => (
            <div className="change-item" key={i}>
              <span className="what">{c.what}</span> — {c.why}
            </div>
          ))}
        </div>
      )}

      {feedback.interpretations.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <strong style={{ fontSize: 13 }}>Reactions</strong>
          {feedback.interpretations.map((interp, i) => (
            <div className="change-item" key={i}>
              <strong>{interp.reaction}</strong>: {interp.meaning}
            </div>
          ))}
        </div>
      )}

      {feedback.clarification && (
        <div className="clarification">{feedback.clarification}</div>
      )}

      <div className="shortlist-summary" style={{ marginTop: 12 }}>
        <span>{feedback.shortlist.length}</span> shortlisted ·{" "}
        <span>{feedback.shown.length}</span> shown ·{" "}
        <span>{feedback.matchedCount}</span> matched
      </div>
    </div>
  );
}
