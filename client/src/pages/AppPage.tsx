import { useState } from "react";
import {
  createSession,
  searchSession,
  sendFeedback,
  freezeSession,
} from "../api/sessions";
import { SearchBar } from "../components/SearchBar";
import { CriteriaPanel } from "../components/CriteriaPanel";
import { Results } from "../components/Results";
import { ImprovementBar } from "../components/ImprovementBar";
import { ErrorBox } from "../components/ErrorBox";
import type { Filters, Rubric } from "../models/criteria";
import type { Reaction, SearchResult, FeedbackResult } from "../models/session";

export function AppPage() {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [reactions, setReactions] = useState<
    Record<string, "match" | "no_match">
  >({});

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    setReactions({});
    setMessage("");
    run(async () => {
      const created = await createSession(query);
      setSessionId(created.sessionId);
      setFilters(created.filters);
      setRubric(created.rubric);
      const searched = await searchSession(
        created.sessionId,
        created.filters,
        created.rubric,
      );
      setResult(searched);
      setFeedback(null);
      setIsFrozen(false);
    });
  };

  const toggleReaction = (profileId: string, verdict: "match" | "no_match") => {
    setReactions((prev) => {
      const next = { ...prev };
      if (next[profileId] === verdict) delete next[profileId];
      else next[profileId] = verdict;
      return next;
    });
  };

  const handleFeedback = () => {
    const list: Reaction[] = Object.entries(reactions).map(
      ([profileId, verdict]) => ({
        profileId,
        verdict,
      }),
    );
    if (list.length === 0) return;
    run(async () => {
      const next = await sendFeedback(sessionId!, message || undefined, list);
      setFeedback(next);
      setFilters(next.filters);
      setRubric(next.rubric);
      setResult(next);
      setMessage("");
      setReactions({});
    });
  };

  const handleFreeze = () => {
    if (!sessionId) return;
    run(async () => {
      await freezeSession(sessionId);
      setIsFrozen(true);
    });
  };

  const handleReset = () => {
    setQuery("");
    setMessage("");
    setReactions({});
    setSessionId(null);
    setFilters(null);
    setRubric(null);
    setResult(null);
    setFeedback(null);
    setIsFrozen(false);
    setError(null);
  };

  if (!sessionId) {
    return (
      <div className="container">
        <div className="hero">
          <h1>
            Find your
            <br />
            next hire
          </h1>
          <p>
            Describe the role and we refine it into filters, rank candidates,
            and let you shortlist with feedback.
          </p>
        </div>
        <SearchBar
          query={query}
          onChange={setQuery}
          onSearch={handleSearch}
          loading={loading}
        />
        {error && (
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "red" }}>
            {error}
          </p>
        )}
        <p
          style={{
            textAlign: "center",
            marginTop: 16,
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          The server needs a valid LLM key to run.
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <ErrorBox error={error} onDismiss={handleReset} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <button className="btn btn-sm btn-outline" onClick={handleReset}>
          ← New search
        </button>
      </div>

      {filters && rubric && (
        <>
          <CriteriaPanel filters={filters} rubric={rubric} />

          <Results
            result={result!}
            loading={loading}
            onVerdict={toggleReaction}
            reactions={reactions}
          />

          {feedback && <ImprovementBar feedback={feedback} />}

          {feedback && (
            <div className="feedback-box" style={{ marginTop: 16 }}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add more feedback..."
                style={{
                  width: "100%",
                  minHeight: 60,
                  padding: 12,
                  border: "1px solid var(--line)",
                  borderRadius: 4,
                  fontFamily: "inherit",
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleFeedback}
                  disabled={!message.trim() || loading}
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {!isFrozen && (
            <button
              className="btn btn-freeze"
              onClick={handleFreeze}
              disabled={loading}
              style={{ marginTop: 16 }}
            >
              {loading ? "Freezing..." : "Freeze"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
