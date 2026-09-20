export interface Config {
  llmApiKey: string;
  llmBaseUrl?: string;
  llmModel: string;
  port: number;
  profilesPath: string;
  faultInjection: boolean;
}

export function loadConfig(): Config {
  if (!process.env.LLM_API_KEY) throw new Error("LLM_API_KEY is required");
  return {
    llmApiKey: process.env.LLM_API_KEY,
    llmBaseUrl: process.env.LLM_BASE_URL,
    llmModel: process.env.LLM_MODEL ?? "llama-3.1-8b-instant",
    port: Number(process.env.PORT ?? 4000),
    profilesPath: process.env.PROFILES_PATH ?? "../data/profiles.json",
    faultInjection: process.env.ENABLE_FAULT_INJECTION === "true",
  };
}
