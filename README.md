# profile-sorter

A sourcing refinement loop. You type a free-text query, and the system turns it into filters and a rubric using an LLM, applies those filters to a pool of 48 profiles, scores the matches, and lets you shortlist candidates with feedback. One page, one loop, end to end.

---

## Overview of the project

profile-sorter automates the first step of recruiting. Instead of reading through 48 resumes, you describe the role in plain English and the system does the rest:

1. The LLM turns your query into **filters** (objective: skills, years, location, company type) and a **rubric** (subjective: what makes a good fit).
2. Code applies those filters to the dataset and returns the top 5 candidates.
3. You react to each candidate (match / no-match) and the LLM refines the filters and rubric.
4. You keep going until you have a shortlist, then freeze it.

Everything runs server-side with real LLM calls. The client is a single React page that calls the backend directly.

---

## Architecture — modular monolith

The server is a single Express process organized into feature modules. Each module owns its models, DTOs, services, and routes. Nothing reaches into another module's internals.

```
HTTP routes
  → sessions controller (orchestrator)
      → criteria service       LLM call 1: query → filters + rubric
      → search service         Code filter: apply filters to profiles
      → scoring service        LLM call 2: score each profile
      → refinement service     LLM call 3: update filters + rubric
      → profiles repository    loads profiles.json, builds catalog
      → in-memory store        Map of all sessions
```

**One LLM client** (`llm/openai.client.ts`) is the only place that talks to the OpenAI SDK. Every module calls through it. It handles timeout (30 s), retries (2× on 429/5xx), and JSON validation.

**Session state** lives in a single `Map` in memory. No database, no persistence. On restart sessions are lost — acceptable for v0.

**CORS** is pinned via `CLIENT_URL` in `app.ts`. Error handling is one middleware — all errors map to HTTP statuses.

---

## Domains and the logic they use

### criteria — LLM call 1

Turns a free-text query into structured filters and a rubric.

- Input: query + dataset vocabulary (skills, locations, company types, year range).
- Rules: never guesses unstated constraints (leaves them empty), translates "4-7 years" to min 4 / max 7, expands spelling variants (Bangalore/Bengaluru, RDS/AWS RDS), puts seniority words without numbers into the rubric.
- Output: `filters` (objective, checkable) + `rubric` (subjective) + `assumptions`.

### search — code filter (no LLM)

Applies filters to the 48 profiles. Pure code, zero LLM calls.

- **Skills**: whole-token match. `RDS` matches `AWS RDS`. `Java` never matches `JavaScript`. `SQL` never matches `PostgreSQL`.
- **Experience**: inclusive range on `years_experience`.
- **Location**: case-insensitive match against listed values.
- **Company**: checks `current_company_type` and (for `scope: "any"`) every `past_companies[].company_type`.
- Returns matched profiles sorted by id.

### scoring — LLM call 2

Scores each filtered profile against the rubric.

- Input: rubric + a batch of about 12 profiles.
- The LLM scores each criterion 0-10 and writes a 1-2 sentence explanation citing real profile fields.
- **Code computes the overall score**: `100 × Σ(weight × score/10) / Σ(weight)`. The LLM never ranks.
- **Citation check**: each cited value must exist in that profile's field. Bad citations dropped. If fewer than 2 remain, a simple explanation is built from real fields instead.
- **Cache**: scores are cached per (rubric, profile). Filter-only changes never re-score.

### refinement — LLM call 3

Updates filters and rubric based on recruiter feedback.

- Input: current filters + rubric, shown profiles in display order, the recruiter's message, and earlier feedback.
- Rules: make the smallest change the feedback supports. Objective feedback ("too junior", "wrong city") changes filters. Subjective feedback changes the rubric. Don't undo earlier changes. Keep approved profiles matching. If feedback is unclear, ask one question and change nothing.
- Output: new filters, new rubric, what each reaction meant, a summary, a list of changes, and an optional clarification.

### sessions — orchestrator

Ties everything together. Coordinates create → search → feedback → freeze. Each step calls the other services and returns typed results. The session stays unchanged if any step fails.

### profiles — repository

Loads `data/profiles.json`, validates it, and builds the catalog (distinct skills, locations, company types, year range). This is the only module that reads the file.

---

## Decisions

Full context in `docs/DECISIONS.md`. One line each:

- **In-memory Map, no persistence** — sessions lost on restart. Fine for v0.
- **No test framework** — automated tests out of scope; verified via tsc + live node checks + curl.
- **No `dotenv`** — compose uses `env_file`, local dev sources `.env` via shell.
- **CommonJS + `tsc` build** — avoids ESM loader friction in Docker.
- **No zod** — strict DTO classes with bean-style checks validate every request/response body.
- **Model = interfaces, DTO = validation classes, repo = JSON file, service = logic, controller = HTTP mapping** — clean MVC.
- **Skill match is whole token/segment** — `RDS` hits `AWS RDS`, `Java` never hits `JavaScript`.
- **Score cache keyed on full rubric JSON + profile id** — filter-only changes never re-score.
- **Unclear feedback applies reactions but keeps criteria** — explicit verdicts stand, `clarification` asks one question.
- **Error handler exported separately from `createApp`** — Express requires error middleware after routes.

---

## Expected scale and tradeoffs

The dataset is fixed at **48 profiles**. This is not a system designed to scale to millions of records — it's a tool for one recruiter, one session, one loop.

| Decision                             | Tradeoff                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| In-memory `Map` for sessions         | Loses all state on restart. No recovery. Chosen over a database because v0 is single-user and sessions are short-lived. |
| No pagination                        | 48 profiles is tiny. Showing 5 at a time is enough. No need for cursor-based pagination.                                |
| No caching layer                     | Scores are cached in-memory per session. Redis would be overkill for 48 profiles and one user.                          |
| One LLM call per step                | Three LLM calls per session. Streaming would improve UX but adds complexity. Out of scope for v0.                       |
| No auth                              | Single user. No need for JWT, sessions, or OAuth.                                                                       |
| Bean-style validation instead of zod | Smaller dependency footprint. DTO classes are explicit and beginner-friendly.                                           |
| CommonJS                             | Slightly older but avoids ESM loader issues in Docker.                                                                  |

The system is built to work reliably with one user, one dataset, and one workflow. If it ever needs to scale, the modular structure makes it easy to extract modules into services.

---

## API endpoints

Base path `/api`. JSON in and out.

### `POST /sessions`

Create a new session from a query.

**Request**:

```json
{ "query": "RDS developers, 4-7 years, startups, Bangalore" }
```

**Response (200)**:

```json
{
  "sessionId": "abc123",
  "filters": {
    "skills": {
      "allOf": [{ "name": "RDS", "aliases": ["AWS RDS"] }],
      "anyOf": []
    },
    "experience": { "minYears": 4, "maxYears": 7 },
    "locations": ["Bangalore"],
    "companyBackground": { "types": ["startup"], "scope": "any" }
  },
  "rubric": {
    "roleSummary": "Backend engineer with production RDS experience from a startup.",
    "criteria": [
      {
        "id": "c1",
        "label": "Database depth",
        "description": "Owned schema design.",
        "weight": 5
      }
    ]
  },
  "assumptions": ["around 5 years → 4-6"]
}
```

### `POST /sessions/:id/search`

Run the filter + score loop. Send both `filters` and `rubric` if the recruiter edited them.

**Request**:

```json
{ "filters": { ... }, "rubric": { ... } }
```

**Response (200)**:

```json
{
  "totalProfiles": 48,
  "matchedCount": 12,
  "shown": [
    {
      "profile": { "id": "p1", "name": "Jane Doe", "current_title": "Engineer", ... },
      "score": 85,
      "criterionScores": [{ "id": "c1", "score": 9 }],
      "explanation": "Strong database experience.",
      "citations": [{ "field": "skills", "value": "RDS" }]
    }
  ],
  "shortlist": [],
  "exhausted": false,
  "hint": null
}
```

### `POST /sessions/:id/feedback`

Submit reactions and an optional message. Updates filters + rubric and returns new results.

**Request**:

```json
{
  "message": "1 is too junior, 2 and 4 are right",
  "reactions": [
    { "profileId": "p1", "verdict": "match" },
    { "profileId": "p2", "verdict": "no_match" }
  ]
}
```

**Response (200)**:

```json
{
  "summary": "Adjusted experience range upward.",
  "changes": [{ "what": "experience.minYears", "why": "Feedback said too junior" }],
  "interpretations": [{ "reaction": "match", "meaning": "Strong fit, keep in shortlist" }],
  "clarification": null,
  "filters": { ... },
  "rubric": { ... },
  "matchedCount": 10,
  "shown": [...],
  "shortlist": [...],
  "exhausted": false
}
```

### `POST /sessions/:id/freeze`

Lock the session and return the final shortlist.

**Request**: none

**Response (200)**:

```json
{
  "filters": { ... },
  "rubric": { ... },
  "shortlist": [{ "profile": ..., "score": 85, ... }],
  "otherMatches": [{ "profile": ..., "score": 72, ... }]
}
```

Further operations return `SESSION_FROZEN` (409).

### `GET /catalog`

Returns the dataset vocabulary for filter editors.

**Response (200)**:

```json
{
  "skills": ["RDS", "PostgreSQL", "Python", ...],
  "locations": ["Bangalore", "Remote - India", ...],
  "companyTypes": ["startup", "scaleup", "enterprise", "agency"],
  "minYears": 2,
  "maxYears": 13
}
```

### Error format

All errors follow the same shape:

```json
{
  "error": {
    "code": "LLM_RATE_LIMITED",
    "message": "Rate limited",
    "retryable": true
  }
}
```

| Code                | Status | Meaning                   |
| ------------------- | ------ | ------------------------- |
| `VALIDATION_ERROR`  | 400    | Bad request body          |
| `SESSION_NOT_FOUND` | 404    | Session does not exist    |
| `SESSION_FROZEN`    | 409    | Session already frozen    |
| `LLM_RATE_LIMITED`  | 429    | Rate limited — retry      |
| `LLM_TIMEOUT`       | 504    | LLM timed out             |
| `LLM_UNAVAILABLE`   | 502    | LLM unavailable           |
| `LLM_BAD_OUTPUT`    | 502    | LLM returned invalid JSON |
| `INTERNAL_ERROR`    | 500    | Unexpected error          |

---

## Running

```bash
cp .env.example .env        # set your LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
docker compose up --build   # server on http://localhost:4000, client on http://localhost:5173
```

**Local dev** (needed for fault injection demo):

```bash
cd server && npm install && set -a && source ../.env && set +a && npm run dev
cd client && npm install && npm run dev
```

### `.env`

```
LLM_API_KEY=sk-or-v1-...          # your OpenRouter API key
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=inclusionai/ling-3.0-flash-vl:free
PORT=4000
PROFILES_PATH=../data/profiles.json
ENABLE_FAULT_INJECTION=false
```

The `.env` file is never committed. Only `.env.example` is tracked.

---

## Fault injection (dev only)

Make real LLM attempts fail to demonstrate recovery and error handling.

Enable with `ENABLE_FAULT_INJECTION=true`, then add headers:

| Header                | Value                                        |
| --------------------- | -------------------------------------------- |
| `X-Debug-Fault`       | `rate_limit`, `timeout`, or `malformed_json` |
| `X-Debug-Fault-Count` | Number of attempts to fail (default 1)       |

Count 1 shows silent recovery. A count above the retry limit shows the error state.

```bash
curl -X POST http://localhost:4000/api/sessions \
  -H "X-Debug-Fault: rate_limit" \
  -H "X-Debug-Fault-Count: 2" \
  -H "Content-Type: application/json" \
  -d '{"query": "RDS developers"}'
```
