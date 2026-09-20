# profile-sorter Server v0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working v0 server per handoff: sessions loop (criteria → filter → score → feedback → freeze) with real LLM calls.

**Architecture:** Modular monolith, Express + TS. Routes → sessions service → criteria/search/scoring/refinement. Only `llm/client.ts` touches the OpenAI SDK. In-memory Map store.

**Tech Stack:** Node 22+ + TypeScript + Express, `openai` SDK (OpenAI-compatible baseURL), Zod. Docker multi-stage + compose.

**Spec:** User handoff in chat (`docs/SERVER_HANDOFF.md` to be saved verbatim alongside this build); dataset `data/profiles.json` (48 profiles, verified present).

## Global Constraints

- Real server-side LLM calls only at runtime; key from env var, never committed.
- Prompts live in repo as readable `server/prompts/*.md`; temperature 0; `response_format: json_object`; SDK `maxRetries: 0`, own retry ≤2 + 1 malformed-output retry.
- Untrusted text inside marked data blocks only.
- Minimal comments in code (owner instruction).
- No auth, logging setup, rate limiting, persistence, tests suite, streaming (out of scope per §10).

## Review Focus

- `Java` matching `JavaScript` in skill filter — must be whole-word/token match.
- Session mutated on failed LLM step — must stay unchanged, typed error returned.
- Citation values not copied exactly — must drop bad ones, fallback explanation if <2 remain.
- Rejected profiles reappearing in later rounds — must never come back.
- Post-freeze writes returning success — must return SESSION_FROZEN.

---

### Task 1: Scaffold + config + app shell

**Files:**

- Create: `server/package.json`, `server/tsconfig.json`, `server/src/config.ts`, `server/src/app.ts`, `server/src/index.ts`, `.env.example`, `.gitignore`
- Test: manual `npm run dev` boot + `GET /api/catalog` 500-free (catalog comes Task 2; here just 404-free boot)

**Interfaces:**

- Consumes: env (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `PORT`, `PROFILES_PATH`, `ENABLE_FAULT_INJECTION`)
- Produces: `loadConfig(): Config` (throws if `LLM_API_KEY` missing); `createApp(): Express`; error middleware mapping `AppError.code` → HTTP status

- [ ] **Step 1: Write package.json + tsconfig + config.ts + app.ts + index.ts + .env.example + .gitignore**

```json
// server/package.json
{
  "name": "profile-sorter-server",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "openai": "^4.60.0",
    "zod": "^3.23.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "@types/node": "^22.0.0"
  }
}
```

```ts
// server/src/config.ts
export interface Config {
  llmApiKey: string;
  llmBaseUrl?: string;
  llmModel: string;
  port: number;
  profilesPath: string;
  faultInjection: boolean;
}
export function loadConfig(): Config {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error("LLM_API_KEY is required");
  return {
    llmApiKey: key,
    llmBaseUrl: process.env.LLM_BASE_URL,
    llmModel: process.env.LLM_MODEL ?? "llama-3.1-8b-instant",
    port: Number(process.env.PORT ?? 4000),
    profilesPath: process.env.PROFILES_PATH ?? "../data/profiles.json",
    faultInjection: process.env.ENABLE_FAULT_INJECTION === "true",
  };
}
```

```ts
// server/src/app.ts
import express from "express";
import cors from "cors";
export interface AppError extends Error {
  code: string;
  status: number;
  retryable: boolean;
}
export const err = (
  code: string,
  status: number,
  message: string,
  retryable = false,
): AppError => Object.assign(new Error(message), { code, status, retryable });
const STATUS: Record<string, number> = {
  VALIDATION_ERROR: 400,
  SESSION_NOT_FOUND: 404,
  SESSION_FROZEN: 409,
  LLM_RATE_LIMITED: 429,
  LLM_UNAVAILABLE: 502,
  LLM_BAD_OUTPUT: 502,
  LLM_TIMEOUT: 504,
};
export function errorToStatus(code: string): number {
  return STATUS[code] ?? 500;
}
export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use((e: any, _req: any, res: any, _next: any) => {
    const code = e.code ?? "INTERNAL_ERROR";
    res
      .status(e.status ?? errorToStatus(code))
      .json({
        error: {
          code,
          message: e.message ?? "internal error",
          retryable: !!e.retryable,
        },
      });
  });
  return app;
}
```

- [ ] **Step 2: Boot it**

Run: `cd server && npm install && npm run dev`
Expected: listens on 4000, no crash without routes yet

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/tsconfig.json server/src/config.ts server/src/app.ts server/src/index.ts .env.example .gitignore
git commit -m "feat(server): scaffold + config + app shell"
```

### Task 2: Profiles repo + catalog + pure filter

**Files:**

- Create: `server/src/modules/profiles/profiles.repository.ts`, `server/src/modules/search/filter.ts`
- Test: `node -e` script: load 48, catalog contains "AWS RDS", filter `{skills allOf RDS, exp 4-7, loc Bangalore, startup}` matches p01; `Java` ⫬ `JavaScript` synthetic check

**Interfaces:**

- Consumes: `PROFILES_PATH` json
- Produces: `loadProfiles(path): Profile[]`; `getCatalog(profiles): { skills, locations, companyTypes, minYears, maxYears }`; `applyFilters(profiles, filters): Profile[]`

```ts
// filter.ts core
const tok = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/g)
    .filter(Boolean);
export function skillHit(have: string[], terms: string[]): boolean {
  const h = have.flatMap(tok);
  return terms.every((t) => {
    const ts = new Set(tok(t));
    return [...ts].every((x) => h.includes(x));
  });
}
```

- [ ] **Step 1: Write repo + filter per §5.2 (inclusive years, case-insensitive loc, token skill match on skills array only, companyBackground any/current)**
- [ ] **Step 2: Verify with node script** — Run: `npx tsx -e "import('./src/modules/search/filter.ts')..."` Expected: p01 in results; Java/JS negative holds
- [ ] **Step 3: Commit** — `git commit -m "feat(server): profiles repo + catalog + filter"`

### Task 3: LLM client + prompt loader + 3 prompts + fault injection

**Files:**

- Create: `server/src/llm/client.ts`, `server/src/llm/prompts.ts`, `server/prompts/generate-criteria.md`, `server/prompts/score-profiles.md`, `server/prompts/refine-criteria.md`
- Test: `X-Debug-Fault: rate_limit` count 1 → recovers; count 9 → `LLM_RATE_LIMITED`; `malformed_json` twice → `LLM_BAD_OUTPUT`

**Interfaces:**

- Consumes: `Config`, prompt files with `{{var}}`
- Produces: `chatJson<T>(schema: ZodType<T>, opts: { system: string; user: string }): Promise<T>` — timeout ~30s, retry ≤2 on 429/5xx/timeout honoring Retry-After, SDK maxRetries 0, one validation-feedback retry; `loadPrompt(name, vars)`

- [ ] **Step 1: Write client.ts + prompts.ts + 3 prompt files (header + system/user + data blocks + exact JSON shape, temp 0)**
- [ ] **Step 2: Verify fault paths with curl once wired (Task 6) or direct node call**
- [ ] **Step 3: Commit** — `git commit -m "feat(server): llm client + prompts + fault injection"`

### Task 4: Zod schemas (criteria / scoring / refinement)

**Files:**

- Create: `server/src/modules/criteria/criteria.schema.ts`, `server/src/modules/scoring/scoring.schema.ts`, `server/src/modules/refinement/refinement.schema.ts`
- Test: sample §5.1 JSON parses; weight 6 / 2-criteria rubric rejected

**Interfaces:**

- Produces: `CriteriaSchema`, `ScoreBatchSchema`, `RefinementSchema` (+ TS types)

- [ ] **Step 1: Write schemas (filters skills allOf/anyOf{name,aliases}, exp min/max, locations[], companyBackground{types,scope}; rubric 3-6 criteria weight 1-5; scores 0-10 + explanation + citations{field,value}; refinement {filters,rubric,interpretations,summary,changes{what,why},clarification?})**
- [ ] **Step 2: Validate samples via tsx one-liner**
- [ ] **Step 3: Commit** — `git commit -m "feat(server): zod schemas for criteria/scoring/refinement"`

### Task 5: Criteria service (LLM 1) + scoring service (LLM 2)

**Files:**

- Create: `server/src/modules/criteria/criteria.service.ts`, `server/src/modules/scoring/scoring.service.ts`
- Test: sample query → filters/rubric/assumptions sane; batch of 12 scored, `score=100*Σ(w*s/10)/Σw`, sorted desc ties by id, citations verified, fallback explanation, cache key stable-stringify(rubric)+profileId

**Interfaces:**

- Consumes: `chatJson`, schemas, catalog vocabulary
- Produces: `generateCriteria(query, catalog): Promise<{filters,rubric,assumptions}>`; `scoreProfiles(profiles, rubric): Promise<ScoredProfile[]>` (batches ~12, cache Map)

- [ ] **Step 1: Write both services**
- [ ] **Step 2: Live-verify with real LLM call (sample query)**
- [ ] **Step 3: Commit** — `git commit -m "feat(server): criteria + scoring services"`

### Task 6: Refinement service (LLM 3) + sessions store/service/routes

**Files:**

- Create: `server/src/modules/refinement/refinement.service.ts`, `server/src/modules/sessions/sessions.store.ts`, `server/src/modules/sessions/sessions.service.ts`, `server/src/modules/sessions/sessions.routes.ts`
- Test: full loop — create → search (5 shown) → feedback "1 too junior, 2 and 4 right" → new 5, 2&4 shortlisted → freeze returns finals; frozen write → 409; COBOL+Mars → matchedCount 0 no error

**Interfaces:**

- Produces: `POST /api/sessions`, `POST /api/sessions/:id/search`, `POST /api/sessions/:id/feedback`, `POST /api/sessions/:id/freeze`, `GET /api/catalog`; session `{ id, query, filters, rubric, assumptions, seenIds, decisions: Map<id, verdict>, shortlist, frozen, scoreCache }`; feedback resolves "1"/"#2" via shown display order

- [ ] **Step 1: Write refinement service (minimal-change rules, unclear → clarification + no change) + store/service/routes (rounds of 5 unseen, exhausted flag, zero-match hint)**
- [ ] **Step 2: End-to-end curl verification of DoD 1-4 + 6**
- [ ] **Step 3: Commit** — `git commit -m "feat(server): refinement + sessions loop + routes"`

### Task 7: Docker + docs + final verification

**Files:**

- Create: `server/Dockerfile`, `docker-compose.yml`, `README.md`, `docs/SERVER_HANDOFF.md`, `docs/DECISIONS.md`
- Test: `docker compose up --build` serves; fault-injection demo (count 1 recovery, over-limit error); `POST /freeze` finals

- [ ] **Step 1: Write Dockerfile (build tsc, prod deps, copy prompts), compose (server + .env + ro data mount + commented client), README (run, env var names, Decisions), DECISIONS.md (one line per choice)**
- [ ] **Step 2: Run full DoD checklist 1-7**
- [ ] **Step 3: Commit** — `git commit -m "feat(server): docker + docs, v0 done"`
