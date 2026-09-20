# Decisions (one line each)

- In-memory Map sessions, no persistence: v0 loses state on restart (spec §3).
- No test framework committed: automated tests out of scope (§10); verified via tsc + live node checks + curl.
- No `dotenv` dependency: compose uses `env_file`, local dev sources `.env` via shell.
- CommonJS + `tsc` build: avoids ESM loader friction in Docker.
- Skill match is whole token/segment: `RDS` hits `AWS RDS`, `Java` never hits `JavaScript`, `SQL` does not hit `PostgreSQL` (LLM gets the vocabulary so it emits exact terms).
- Score cache keyed on full rubric JSON + profile id: filter-only changes never re-score.
- Shortlist profiles re-scored under a new rubric when missing: prevents crashes after refinement changes the rubric.
- Unclear feedback applies reactions but keeps criteria: explicit verdicts stand, `clarification` asks one question.
- `errorHandler` exported separately from `createApp`: Express requires error middleware after routes.
- No git history in this folder: repo had no git initialised, so per-task commits were skipped.
- Layered reorg: per-domain routes/controller/service/repository + model (interfaces + Zod) + DTO; llm/openai.client.ts is the only SDK caller; HTTP statuses live only in app.ts errorHandler (services/LLM throw code-only errors via errors.ts fail()).
- *.schema.ts merged into *.model.ts; search/filter.ts is now search/search.service.ts; sessions.store.ts is sessions.repository.ts; sessions routes thinned into sessions.controller.ts.
- MVC simplification: service layer merged into sessions.controller.ts (whole loop reads top-to-bottom); pure helpers live in models (applyFilters in profiles.repository, scoring math/citations in scoring.model); errors.ts holds fail() + catchErrors decorator (single try/catch boundary); CORS pinned via CLIENT_URL in app.ts.
- MVC fix: model = plain interfaces, DTO = Zod validation for all request/response bodies (service imports it), repo = only talks to the db (JSON file, sessions hashmap), service = the heavy lifting, controller = thin HTTP mapping.
