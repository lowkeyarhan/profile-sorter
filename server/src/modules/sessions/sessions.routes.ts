// Routes: the URL table. Each line points a path at a controller action.
import { Express } from "express";
import { SessionsController } from "./sessions.controller";

export function registerSessionsRoutes(
  app: Express,
  c: SessionsController,
): void {
  app.get("/api/catalog", c.catalog);
  app.post("/api/sessions", c.create);
  app.post("/api/sessions/:id/search", c.search);
  app.post("/api/sessions/:id/feedback", c.feedback);
  app.post("/api/sessions/:id/freeze", c.freeze);
}
