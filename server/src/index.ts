// Entry point: build the classes, wire them together, start the server.
import { createApp, errorHandler } from "./app";
import { loadConfig } from "./config";
import { OpenAIClient } from "./llm/openai.client";
import { CriteriaService } from "./modules/criteria/criteria.service";
import { ProfilesRepository } from "./modules/profiles/profiles.repository";
import { RefinementService } from "./modules/refinement/refinement.service";
import { ScoringService } from "./modules/scoring/scoring.service";
import { SearchService } from "./modules/search/search.service";
import { SessionsController } from "./modules/sessions/sessions.controller";
import { SessionsRepository } from "./modules/sessions/sessions.repository";
import { SessionsService } from "./modules/sessions/sessions.service";
import { registerSessionsRoutes } from "./modules/sessions/sessions.routes";

const config = loadConfig();
const llm = new OpenAIClient(config);
const service = new SessionsService(
  new ProfilesRepository(config.profilesPath),
  new SessionsRepository(),
  new SearchService(),
  new CriteriaService(llm),
  new ScoringService(llm),
  new RefinementService(llm)
);
const controller = new SessionsController(service);

const app = createApp();
registerSessionsRoutes(app, controller);
app.use(errorHandler);
app.listen(config.port, () => console.log(`profile-sorter on :${config.port}`));
