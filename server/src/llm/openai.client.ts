import OpenAI from "openai";
import { fail } from "../errors";
import { Config } from "../config";

const TIMEOUT_MS = 30000;

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export interface FaultOpts {
  fault?: string;
  faultCount?: number;
}

export interface LlmOpts extends FaultOpts {
  system: string;
  user: string;
}

export class OpenAIClient {
  private sdk: OpenAI;
  private armed = new Map<string, number>();

  constructor(private config: Config) {
    this.sdk = new OpenAI({
      apiKey: config.llmApiKey,
      baseURL: config.llmBaseUrl,
      maxRetries: 0,
      timeout: TIMEOUT_MS,
    });
  }

  model(): string {
    return this.config.llmModel;
  }

  private takeFault(
    fault?: string,
    count?: number,
  ): "rate_limit" | "timeout" | "malformed_json" | null {
    if (!this.config.faultInjection || !fault) return null;
    if (!this.armed.has(fault))
      this.armed.set(fault, count && count > 0 ? count : 1);
    const left = this.armed.get(fault) ?? 0;
    if (left <= 0) return null;
    this.armed.set(fault, left - 1);
    return fault === "rate_limit" ||
      fault === "timeout" ||
      fault === "malformed_json"
      ? fault
      : null;
  }

  private async once(system: string, user: string): Promise<string> {
    const res = await this.sdk.chat.completions.create({
      model: this.config.llmModel,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    } as any);
    return res.choices[0]?.message?.content ?? "";
  }

  private extractJson(text: string): unknown {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start)
      throw new SyntaxError("no JSON object in reply");
    return JSON.parse(text.slice(start, end + 1));
  }

  private retryable(e: any): boolean {
    const s = e?.status;
    return (
      s === 429 ||
      (typeof s === "number" && s >= 500) ||
      e?.code === "ETIMEDOUT" ||
      e?.code === "ECONNABORTED" ||
      /timeout/i.test(e?.message ?? "")
    );
  }

  private toTyped(e: any): never {
    const s = e?.status;
    if (s === 429 || /429/.test(e?.message ?? ""))
      throw fail("LLM_RATE_LIMITED", "LLM rate limited", true);
    if (/timeout/i.test(e?.message ?? "") || e?.code === "ETIMEDOUT")
      throw fail("LLM_TIMEOUT", "LLM call timed out", true);
    throw fail("LLM_UNAVAILABLE", "LLM unavailable", true);
  }

  // validate turns the raw JSON into a strict DTO object (or throws VALIDATION_ERROR).
  async completeJson<T>(
    validate: (data: unknown) => T,
    opts: LlmOpts,
  ): Promise<T> {
    let text = "";
    let lastIssue = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const fault = this.takeFault(opts.fault, opts.faultCount);
      try {
        if (fault === "rate_limit")
          throw { status: 429, message: "429 simulated" };
        if (fault === "timeout")
          throw { code: "ETIMEDOUT", message: "timeout simulated" };
        text =
          fault === "malformed_json"
            ? "{not json"
            : await this.once(
                opts.system,
                lastIssue
                  ? `${opts.user}\n\nPrevious output failed validation: ${lastIssue}. Reply with corrected JSON only.`
                  : opts.user,
              );
        return validate(this.extractJson(text));
      } catch (e: any) {
        if (e?.code && e?.status && !this.retryable(e)) this.toTyped(e);
        if (
          e instanceof SyntaxError ||
          e?.code === "VALIDATION_ERROR" ||
          /not json/.test(text)
        ) {
          lastIssue = e?.message ?? "invalid JSON";
          break;
        }
        if (this.retryable(e) && attempt < 2) {
          const wait = Number(e?.headers?.["retry-after"] ?? NaN);
          await sleep(
            Number.isFinite(wait) ? wait * 1000 : 500 * (attempt + 1),
          );
          continue;
        }
        this.toTyped(e);
      }
    }
    try {
      text = await this.once(
        opts.system,
        `${opts.user}\n\nPrevious output failed validation: ${lastIssue}. Reply with corrected JSON only.`,
      );
      return validate(JSON.parse(text));
    } catch {
      throw fail("LLM_BAD_OUTPUT", "LLM returned malformed output", false);
    }
  }
}
