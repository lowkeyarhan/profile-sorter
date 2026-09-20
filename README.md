# profile-sorter

A sourcing refinement loop. A free-text query is turned into filters and a rubric by an LLM, code applies them to a pool of 48 profiles, the LLM scores the matches, and the recruiter shortlists with feedback. One page, one loop, end to end.

## Contents

- [Overview & About](#overview--about)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [How It Works](#how-it-works)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Decisions](#decisions)
- [Running](#running)
- [Fault Injection](#fault-injection)

---

## Overview & About

profile-sorter is a **modular monolith** that orchestrates a single recruiting workflow. A recruiter types a query like *"RDS developers, 4-7 years, startups, Bangalore"* and the system refines it through three LLM calls and two rounds of code filtering until a shortlist of top candidates is frozen.

The entire state of a session lives in memory — no database, no persistence. On restart the session is lost, which is fine for v0.

---

## System Architecture

The application follows a **modular monolith** with feature-driven modules. Each module owns its models, DTOs, services, and routes. The only shared concern is the LLM client — every module calls through it.

```
HTTP routes  →  sessions controller (orchestrator)  →  criteria / search / scoring / refinement services
                                                      |                        |
                                                profiles repo (JSON)     llm client (openai SDK)
                                                      |
                                              in-memory session store (Map)
```

- **Routes** only parse input and call the controller.
- **Controller** is the only place that coordinates modules.
- **Search (filter)** is plain code — never calls the LLM.
- **Only** `llm/openai.client.ts` talks to the OpenAI SDK.
- Session state lives in a single `Map` (lost on restart).
- CORS is pinned via `CLIENT_URL` in `app.ts`.

### Modules

| Module | Responsibility |
| --- | --- |
| **criteria** | LLM call 1 — turns a query into filters + rubric + assumptions |
| **search** | Code filter — applies filters to 48 profiles (pure, no LLM) |
| **scoring** | LLM call 2 — scores each profile against the rubric, computes weighted score, verifies citations |
| **refinement** | LLM call 3 — updates filters + rubric based on recruiter feedback |
| **sessions** | Orchestrates the full loop — create, search, feedback, freeze |
| **profiles** | Loads and validates `data/profiles.json`, builds the catalog |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Express + TypeScript (CommonJS) |
| Runtime | Node 22 |
| LLM | `openai` SDK — any OpenAI-compatible provider via `LLM_BASE_URL` |
| Validation | Bean-style DTO classes (`src/validation.ts`) — every request/response body |
| Build | `tsc` + `tsx` for dev |
| Container | Docker + docker-compose |
| Data | `data/profiles.json` (48 profiles, in-memory) |

---

## How It Works

A session runs through six steps:

1. **Create** — Recruiter types a query. The LLM returns `filters` (objective), `rubric` (subjective), and `assumptions`.
2. **Search** — Code applies filters to the 48 profiles. Top 5 are shown with scores and explanations.
3. **Score** — The LLM scores each rubric criterion 0-10 per profile with citations. Code computes the weighted score and ranks.
4. **Feedback** — Recruiter reacts (match/no-match) and can add a message. The LLM updates filters + rubric, explains what changed.
5. **Shortlist** — Matches go to the shortlist, rejected profiles never return. Each round shows the next 5 unreviewed profiles.
6. **Freeze** — Final filters, rubric, and ranked shortlist are locked. Further changes return `SESSION_FROZEN`.

### Filtering Rules

- **Experience**: inclusive range on `years_experience`.
- **Location**: case-insensitive match against any listed value.
- **Skills**: whole-token match. `RDS` matches `AWS RDS`; `Java` never matches `JavaScript`.
- **Company**: checks `current_company_type` and (for `scope: "any"`) every `past_companies[].company_type`.
- The dataset vocabulary is passed to the LLM so it only emits filters that exist in the data.

### Scoring Rules

- Each rubric criterion scored 0-10 by the LLM with 1-2 sentence explanations citing real profile fields.
- Overall score: `100 * Σ(weight × score/10) / Σ(weight)`, computed in code — the LLM never ranks.
- Citation check: each cited value must exist in that profile's field. Bad citations dropped. If fewer than 2 remain, a simple explanation is built from real fields instead.
- Scores are cached per (rubric, profile) so filter-only changes never re-score.

---

## API Reference

Base path `/api`. JSON in and out.

### `POST /sessions`

Creates a new session from a query.

**Body**: `{ query: string }`

**Response**: `{ sessionId, filters, rubric, assumptions }`

### `POST /sessions/:id/search`

Runs the filter + score loop. Send both `filters` and `rubric` if the recruiter edited them.

**Body**: `{ filters?, rubric? }`

**Response**: `{ totalProfiles, matchedCount, shown[], shortlist[], exhausted, hint }`

Each item in `shown[]` / `shortlist[]`: `{ profile, score, criterionScores[], explanation, citations[] }`.

### `POST /sessions/:id/feedback`

Submits recruiter reactions and an optional message. Updates filters + rubric and returns a new set of results.

**Body**: `{ message?: string, reactions?: [{ profileId, verdict: "match" | "no_match" }] }`

**Response**: `{ summary, changes[], interpretations[], clarification, filters, rubric, matchedCount, shown[], shortlist[], exhausted }`

- Explicit verdicts stand. Unclear feedback applies reactions but keeps criteria and sets `clarification` to one question.
- Rejected profiles never reappear. Matches are added to the shortlist.

### `POST /sessions/:id/freeze`

Locks the session. Returns the final shortlist and other matches.

**Body**: none

**Response**: `{ filters, rubric, shortlist[], otherMatches[] }`

Further operations on a frozen session return `SESSION_FROZEN` (409).

### `GET /catalog`

Returns the dataset vocabulary for filter editors.

**Response**: `{ skills[], locations[], companyTypes[], minYears, maxYears }`

### Errors

All errors follow `{ error: { code, message, retryable } }`.

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Bad request body |
| `SESSION_NOT_FOUND` | 404 | Session does not exist |
| `SESSION_FROZEN` | 409 | Session already frozen |
| `LLM_RATE_LIMITED` | 429 | Rate limited — retry |
| `LLM_TIMEOUT` | 504 | LLM timed out |
| `LLM_UNAVAILABLE` | 502 | LLM unavailable |
| `LLM_BAD_OUTPUT` | 502 | LLM returned invalid JSON |
| `INTERNAL_ERROR` | 500 | Unexpected error |

---

## Project Structure

```
profile-sorter/
├── client/                          # React frontend (single page)
│   ├── src/
│   │   ├── api/                     # API layer — per-domain files with try/catch
│   │   │   ├── http.ts              # shared fetch wrapper + ApiError
│   │   │   ├── sessions.ts          # createSession, searchSession, sendFeedback, freezeSession
│   │   │   └── catalog.ts           # getCatalog
│   │   ├── models/                  # TypeScript interfaces mirroring server DTOs
│   │   │   ├── profile.ts
│   │   │   ├── criteria.ts
│   │   │   └── session.ts
│   │   ├── components/              # Pure presentational components
│   │   │   ├── SearchBar.tsx
│   │   │   ├── CriteriaPanel.tsx
│   │   │   ├── ProfileCard.tsx
│   │   │   ├── Results.tsx
│   │   │   ├── ImprovementBar.tsx
│   │   │   └── ErrorBox.tsx
│   │   └── pages/
│   │       └── AppPage.tsx          # single page — search bar at top, results below
│   ├── Dockerfile
│   └── package.json
├── server/
│   ├── src/
│   │   ├── index.ts                 # entry point — wires classes, starts server
│   │   ├── app.ts                   # express app + CORS + routes + error handler
│   │   ├── config.ts                # reads env vars, fails if LLM_API_KEY missing
│   │   ├── errors.ts                # fail() + catchErrors — single error boundary
│   │   ├── validation.ts            # bean-style DTO checks
│   │   ├── llm/
│   │   │   ├── openai.client.ts     # only SDK caller — timeout, retry, JSON parse + validate
│   │   │   └── prompts.ts           # loads prompts/*.md, fills {{variables}}
│   │   └── modules/
│   │       ├── sessions/
│   │       │   ├── sessions.controller.ts   # thin HTTP layer
│   │       │   ├── sessions.service.ts      # orchestrates the full loop
│   │       │   └── sessions.repository.ts   # in-memory Map store
│   │       ├── criteria/
│   │       │   ├── criteria.service.ts
│   │       │   └── criteria.model.ts        # filters + rubric interfaces
│   │       ├── search/
│   │       │   └── search.service.ts        # applies filters (pure code)
│   │       ├── scoring/
│   │       │   ├── scoring.service.ts       # LLM call 2, citation check, ranking
│   │       │   └── scoring.model.ts
│   │       ├── refinement/
│   │       │   ├── refinement.service.ts    # LLM call 3
│   │       │   └── refinement.model.ts
│   │       └── profiles/
│   │           ├── profiles.repository.ts   # loads profiles.json, builds catalog
│   │           └── profiles.model.ts
│   ├── prompts/
│   │   ├── generate-criteria.md
│   │   ├── score-profiles.md
│   │   └── refine-criteria.md
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── data/
│   └── profiles.json                # 48 profiles = the whole talent pool
├── docs/
│   ├── SERVER_HANDOFF.md            # full spec
│   └── DECISIONS.md                 # one line per decision
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Decisions

One line per decision. Full context in `docs/DECISIONS.md`.

- **In-memory Map sessions, no persistence** — v0 loses state on restart (spec §3).
- **No test framework** — automated tests out of scope; verified via tsc + live node checks + curl.
- **No `dotenv`** — compose uses `env_file`, local dev sources `.env` via shell.
- **CommonJS + `tsc`** — avoids ESM loader friction in Docker.
- **No zod** — strict DTO classes with bean-style checks validate every request/response body.
- **Model = interfaces, DTO = validation classes, repo = JSON file, service = logic, controller = HTTP mapping** — clean MVC separation.
- **Skill match is whole token/segment** — `RDS` hits `AWS RDS`, `Java` never hits `JavaScript`, `SQL` never hits `PostgreSQL`.
- **Score cache keyed on full rubric JSON + profile id** — filter-only changes never re-score.
- **Unclear feedback applies reactions but keeps criteria** — explicit verdicts stand, `clarification` asks one question.
- **Error handler exported separately from `createApp`** — Express requires error middleware after routes.

---

## Running

```bash
cp .env.example .env        # set LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
docker compose up --build   # server on http://localhost:4000, client on http://localhost:5173
```

**Local dev** (required for the fault-injection demo):

```bash
cd server && npm install && set -a && source ../.env && set +a && npm run dev
cd client && npm install && npm run dev
```

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `LLM_API_KEY` | Yes | — | API key, never committed |
| `LLM_BASE_URL` | No | — | OpenAI-compatible endpoint |
| `LLM_MODEL` | No | `llama-3.1-8b-instant` | Model id |
| `PORT` | No | 4000 | Server port |
| `PROFILES_PATH` | No | `../data/profiles.json` | Path to profiles JSON |
| `ENABLE_FAULT_INJECTION` | No | false | Enable dev fault injection |

---

## Fault Injection

Dev-only. Make real LLM attempts fail to demonstrate recovery and error states.

Enable with `ENABLE_FAULT_INJECTION=true`, then send the `X-Debug-Fault` header:

| Header value | Behavior |
| --- | --- |
| `rate_limit` | First N attempts return 429, then recovers |
| `timeout` | First N attempts time out, then recovers |
| `malformed_json` | First N attempts return bad JSON, then recovers |

Add `X-Debug-Fault-Count: N` (default 1) to control how many attempts fail. Count 1 shows silent recovery; a count above the retry limit shows the error state.

Example:

```bash
curl -X POST http://localhost:4000/api/sessions \
  -H "X-Debug-Fault: rate_limit" \
  -H "X-Debug-Fault-Count: 2" \
  -H "Content-Type: application/json" \
  -d '{"query": "RDS developers"}'
```
