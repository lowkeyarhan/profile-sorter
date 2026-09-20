// Sessions repository: the only class that talks to the session "database",
// which is an in-memory hashmap of sessionId -> Session.
import { Session } from "./sessions.model";

export class SessionsRepository {
  private sessions = new Map<string, Session>();

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  save(s: Session): void {
    this.sessions.set(s.id, s);
  }
}
