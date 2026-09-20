# profile-sorter

Sourcing refinement loop over `data/profiles.json`: free-text query → LLM filters + rubric → code filter → LLM scoring → top 5 → feedback → freeze.

## Run

```bash
cp .env.example .env   # set LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
docker compose up --build   # http://localhost:4000
# or local dev (needed for the fault-injection demo):
cd server && npm install && set -a && source ../.env && set +a && npm run dev
```

## API key

`LLM_API_KEY` in `.env` (never committed). `LLM_BASE_URL` points the `openai` SDK at any OpenAI-compatible provider; `LLM_MODEL` names a free-tier model id.

## API (`/api`)

- `POST /sessions` `{query}` → `{sessionId, filters, rubric, assumptions}`
- `POST /sessions/:id/search` `{filters?, rubric?}` → `{totalProfiles, matchedCount, shown[], shortlist[], exhausted}`
- `POST /sessions/:id/feedback` `{message?, reactions?}` → `{summary, changes[], clarification, filters, rubric, matchedCount, shown[], shortlist[], exhausted}`
- `POST /sessions/:id/freeze` → `{filters, rubric, shortlist[], otherMatches[]}`
- `GET /catalog` → skills, locations, company types, year range

Dev-only fault injection: `ENABLE_FAULT_INJECTION=true` plus `X-Debug-Fault: rate_limit|timeout|malformed_json` and `X-Debug-Fault-Count: N`.

## Decisions

See `docs/DECISIONS.md` (what was prioritised, what was cut and why).
