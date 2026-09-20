# profile-sorter: Server Handoff (v0)

Goal: a **simple, working v0** of the server. Keep it small. No security hardening, no logging setup, no rate limiting, no persistence. The owner (Arhan) defines the classes, interfaces and DTOs himself; this doc defines only the **architecture, file structure and behavior**.

If something is ambiguous, pick the simplest option and note it in `docs/DECISIONS.md`.

---

## 1. What we are building

A sourcing refinement loop for one search session:

1. Recruiter types free text ("RDS developers, 4-7 years, startups, Bangalore").
2. **LLM call 1** turns it into **filters** (objective) + a **rubric** (subjective) + a few **assumptions**.
3. **Code** applies the filters to `data/profiles.json` (48 profiles = the whole talent pool).
4. **LLM call 2** scores the filtered profiles against the rubric. Code ranks them.
5. Top 5 are shown, each with an explanation that cites real profile fields.
6. Recruiter reacts ("1 is too junior, 2 and 4 are right"). **LLM call 3** updates filters + rubric and explains what changed. Code re-filters, re-scores, shows the next 5.
7. Recruiter **freezes**: final filters, final rubric, ranked shortlist.

**Hard rules from the assignment**
- Real server-side LLM calls only (no canned responses at runtime).
- API key from an env var, never committed.
- Prompts live in the repo as readable files.
- LLM output for filters, rubric and scores is **structured and validated**.
- Rate limits, timeouts and malformed output are handled (no crash). See §7.
- Explanations must cite real fields from that profile.
- Runs with one or two commands. No login, no persistence.

---

## 2. Stack

Node 22 + TypeScript + Express, the `openai` SDK (pointed at any OpenAI-compatible provider via base URL), and Zod to validate LLM output and requests. Dockerised.

---

## 3. Architecture (modular monolith, kept simple)

One server process. Feature modules, each with its own service; a thin routes layer; a single shared LLM helper.

```
HTTP routes  ->  sessions service (orchestrator)  ->  criteria / search / scoring / refinement services
                                                        |                        |
                                                  profiles repo (JSON)     llm helper (openai SDK)
                                                        |
                                              in-memory session store (Map)
```

- **Routes** only parse input and call the sessions service.
- **Sessions service** is the only place that coordinates the other modules.
- **Search (filter)** is plain code and never calls the LLM.
- **Only** `llm/client.ts` talks to the OpenAI SDK.
- Modules do not reach into each other's internals; they call each other's service files.
- Session state lives in one in-memory `Map` (lost on restart, which is fine).

---

## 4. File structure

Matches the repo root: `client/`, `data/`, `docs/`, `server/`.

```
profile-sorter/
├── client/                          # Arhan
├── data/
│   └── profiles.json                # provided sample data
├── docs/
│   ├── SERVER_HANDOFF.md            # this file
│   └── DECISIONS.md                 # one line per decision/deviation
├── server/
│   ├── prompts/
│   │   ├── generate-criteria.md
│   │   ├── score-profiles.md
│   │   └── refine-criteria.md
│   ├── src/
│   │   ├── index.ts                 # starts the server
│   │   ├── app.ts                   # express app + CORS + routes + error handler
│   │   ├── config.ts                # reads env vars, fails if LLM_API_KEY missing
│   │   ├── llm/
│   │   │   ├── client.ts            # openai SDK call, timeout, retry, JSON parse + validate
│   │   │   └── prompts.ts           # loads prompts/*.md and fills {{variables}}
│   │   └── modules/
│   │       ├── profiles/
│   │       │   └── profiles.repository.ts   # loads + validates profiles.json, builds the catalog
│   │       ├── criteria/
│   │       │   ├── criteria.service.ts      # LLM call 1
│   │       │   └── criteria.schema.ts       # filters + rubric schemas
│   │       ├── search/
│   │       │   └── filter.ts                # applies filters (pure code)
│   │       ├── scoring/
│   │       │   ├── scoring.service.ts       # LLM call 2, citation check, weighted score, ranking
│   │       │   └── scoring.schema.ts
│   │       ├── refinement/
│   │       │   ├── refinement.service.ts    # LLM call 3
│   │       │   └── refinement.schema.ts
│   │       └── sessions/
│   │           ├── sessions.routes.ts
│   │           ├── sessions.service.ts      # orchestrates create / search / feedback / freeze
│   │           └── sessions.store.ts        # in-memory Map
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 5. Behavior

### 5.1 Filters and rubric (shape only)

```json
{
  "filters": {
    "skills": { "allOf": [{ "name": "RDS", "aliases": ["AWS RDS"] }], "anyOf": [] },
    "experience": { "minYears": 4, "maxYears": 7 },
    "locations": ["Bangalore", "Bengaluru"],
    "companyBackground": { "types": ["startup"], "scope": "any" }
  },
  "rubric": {
    "roleSummary": "Backend engineer with production RDS experience from a startup environment.",
    "criteria": [
      { "id": "c1", "label": "Database depth", "description": "Owned schema design and tuning on RDS/Postgres.", "weight": 5 }
    ]
  }
}
```

- Empty `[]` / `null` = no constraint. `scope: "any"` = current **or** past company; `"current"` = current only.
- 3 to 6 rubric criteria, weight 1-5. The rubric holds **subjective** things; filters hold **checkable** things.

### 5.2 Filtering (code)
- Inclusive experience range on `years_experience`.
- Location matches any listed value (case-insensitive).
- Skills: match by **whole word/token**, using the term or its aliases. `RDS` matches `AWS RDS`; **`Java` must not match `JavaScript`**. Skills are checked only against the `skills` array.
- Company background checks `current_company_type` and (for `any`) every `past_companies[].company_type`.
- The dataset vocabulary (distinct skills, locations, types, year range) is passed to the LLM so it emits filters that actually exist in the data.

### 5.3 Scoring and ranking
- The LLM scores **each rubric criterion 0-10** per profile and writes a 1-2 sentence explanation with **citations** (`field` + exact `value`). Send profiles in batches (about 12 per call).
- **Code** computes the overall score: `100 * Σ(weight × score/10) / Σ(weight)`, sorts descending (ties by id). The LLM never ranks or does the final math.
- **Citation check:** each cited value must really exist in that profile's field. Drop bad ones. If fewer than 2 remain, use a simple explanation built from the profile's real fields instead of the LLM text.
- Cache scores per (rubric, profile) so a filter-only change does not re-score profiles already scored.

### 5.4 Rounds and shortlist
- A round shows the top **5** profiles the recruiter has not reacted to yet.
- Reactions mark a profile `match` or `no_match`. Matches go to the **shortlist**; rejected profiles never come back.
- If fewer than 5 remain, show what is left and flag `exhausted`.
- Zero matches is **not an error**: return the count 0 and (nice-to-have) a hint about which filter is most restrictive.

### 5.5 Refinement (LLM call 3)
- Input: current filters + rubric, the shown profiles in display order (so "1", "#2" resolve), the recruiter's message, and earlier feedback.
- Rules for the prompt: make the smallest change the feedback supports; objective feedback ("too junior", "wrong city") changes filters, subjective feedback changes the rubric; do not undo earlier changes; keep approved profiles matching; if feedback is unclear, ask one short question and change nothing.
- Output: new filters, new rubric, what each reaction meant, a short recruiter-facing summary, and a list of changes (`what` + `why`).
- Nice-to-have: compute the change list by diffing old vs new criteria in code, using the LLM only for the "why".

---

## 6. API (v0)

Base path `/api`. JSON in and out.

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/sessions` | `{ query }` | `{ sessionId, filters, rubric, assumptions }` |
| POST | `/sessions/:id/search` | `{ filters?, rubric? }` (send both if the recruiter edited) | `{ totalProfiles, matchedCount, shown[], shortlist[], exhausted }` |
| POST | `/sessions/:id/feedback` | `{ message?, reactions?: [{ profileId, verdict }] }` | `{ summary, changes[], clarification, filters, rubric, matchedCount, shown[], shortlist[], exhausted }` |
| POST | `/sessions/:id/freeze` | none | `{ filters, rubric, shortlist[], otherMatches[] }` |
| GET | `/catalog` | none | distinct skills, locations, company types (for the filter editor) |

- Each item in `shown[]` / `shortlist[]`: the profile, `score` (0-100), per-criterion scores, `explanation`, `citations[]`.
- `otherMatches` = profiles that pass the final filters and were never reviewed, ranked.
- After `freeze`, further changes to that session return an error.

**Errors:** `{ "error": { "code", "message", "retryable" } }`. Codes: `VALIDATION_ERROR` (400), `SESSION_NOT_FOUND` (404), `SESSION_FROZEN` (409), `LLM_RATE_LIMITED` (429), `LLM_TIMEOUT` (504), `LLM_UNAVAILABLE` (502), `LLM_BAD_OUTPUT` (502), `INTERNAL_ERROR` (500).

---

## 7. Failure handling (required by the assignment, kept minimal)

Everything goes through `llm/client.ts`:

- **Timeout** per call (about 30 s). **Retry up to 2 times** on 429, 5xx and timeouts with a short backoff (honor `Retry-After` if present). Set the SDK's own `maxRetries` to 0 so retries happen in one place.
- **Malformed output:** parse JSON, validate with Zod. On failure, retry **once** with the validation error fed back to the model. If it still fails: `LLM_BAD_OUTPUT`.
- If any step of a flow fails, **the session stays unchanged** and the typed error is returned, so the client can offer Retry.
- Use JSON mode (`response_format: json_object`) by default and describe the exact shape in the prompt. Do not assume the provider supports strict JSON-schema mode.

**Failure demo for the Loom:** in dev only, an `X-Debug-Fault` request header (`rate_limit`, `timeout`, `malformed_json`) makes the **first N real LLM attempts** fail (`X-Debug-Fault-Count`, default 1). Count 1 shows silent recovery; a count above the retry limit shows the error state. It never fakes a successful LLM reply. Ignored unless `ENABLE_FAULT_INJECTION=true`.

---

## 8. Prompts (`server/prompts/`)

Three readable markdown files, each with a short header (name, purpose, inputs, output shape) and a system + user section. **Untrusted text (recruiter input, profile summaries) goes inside clearly marked data blocks, and the prompt states it is data, not instructions.** All calls use temperature 0.

- `generate-criteria.md`: input = query + dataset vocabulary. Rules: never guess unstated constraints (leave empty); "4-7 years" is min 4, max 7; "around 5 years" becomes 4-6 and is listed in assumptions; seniority words without numbers go to the rubric; include spelling variants (Bangalore/Bengaluru, RDS/AWS RDS); rubric has 3-6 subjective criteria, not duplicating filters.
- `score-profiles.md`: input = rubric + a batch of profiles. Rules: score only from the given data; missing evidence means a low score; explanation is specific, 1-2 sentences, no generic praise; at least 2 citations with values copied exactly from the profile; do not compute an overall score or rank.
- `refine-criteria.md`: see §5.5.

---

## 9. Config, env and Docker

`.env` at the repo root (git-ignored); `.env.example` committed with empty secrets:

```bash
LLM_API_KEY=          # the API key variable named in the README
LLM_BASE_URL=         # OpenAI-compatible endpoint (Groq / Gemini / OpenRouter)
LLM_MODEL=            # a free-tier model id
PORT=4000
PROFILES_PATH=../data/profiles.json
ENABLE_FAULT_INJECTION=false
```

- **Dockerfile** in `server/`: multi-stage (build with `tsc`, run with production deps only). Prompts are copied into the image.
- **docker-compose.yml** at the root: a `server` service using `.env`, mounting `./data` read-only into the container and setting `PROFILES_PATH` to the mounted path; a commented `client` service for Arhan to fill in.
- Enable CORS for the client's dev origin so the browser can call the API.

Run:

```bash
cp .env.example .env        # set LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
docker compose up --build   # server on http://localhost:4000
# or: cd server && npm install && npm run dev
```

Note: run the server locally in dev mode for the fault-injection demo.

---

## 10. Definition of done (v0)

1. `POST /sessions` with the sample query returns sensible filters, rubric and assumptions.
2. `POST /search` returns 5 scored profiles, each with a specific explanation and verified citations.
3. `POST /feedback` with "1 is too junior, 2 and 4 are right" changes the criteria, explains why, keeps 2 and 4 in the shortlist and returns a new set of 5.
4. An impossible search (for example skill "COBOL" + location "Mars") returns 0 matches without an error.
5. Fault injection shows one recovery and one clean error.
6. `POST /freeze` returns final filters, rubric and the shortlist.
7. README states: how to run, the **API key env var name**, and a "Decisions" section (Arhan fills this in: what was prioritised, what was cut and why).

**Deliberately out of scope for v0:** auth, security hardening, logging, rate limiting, session expiry, persistence, embeddings/rerankers, streaming, automated tests.
