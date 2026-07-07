import type { z } from "zod";

// AI infrastructure — the provider-agnostic seam (Dependency Inversion).
//
// Automations depend on THIS interface, never on a concrete provider SDK. That
// is what makes every automation unit-testable against a mock and keeps AI as a
// single swappable layer rather than SDK calls sprinkled through the codebase.

export type AiEffort = "low" | "medium" | "high";

export interface AiCompletionRequest<T> {
  /** System prompt: role, rules, guardrails. Kept free of per-request PHI where possible. */
  system: string;
  /** The user/task content for this invocation. */
  prompt: string;
  /** Zod schema the model output must satisfy. Drives structured output + validation. */
  schema: z.ZodType<T>;
  /** JSON-schema name (stable, for provider-side schema caching). */
  schemaName: string;
  /** Optional per-call model override; otherwise the client default. */
  model?: string;
  effort?: AiEffort;
  maxTokens?: number;
}

// Result type — automations never throw for expected failures (unavailable
// provider, invalid/malformed output, safety refusal). Callers branch on `ok`
// and fall back to the manual workflow. This is the fail-safe contract: a bad
// or missing AI response must never corrupt clinical data or block a request.
export type AiResult<T> =
  | { ok: true; value: T; model: string }
  | { ok: false; error: AiError };

export interface AiError {
  kind: "unavailable" | "refused" | "invalid_output" | "provider_error";
  message: string;
}

// The port. One method, structured output only — no free-text generation
// surface, so every automation has a validated, typed result.
export interface AiClient {
  readonly name: string;
  complete<T>(req: AiCompletionRequest<T>): Promise<AiResult<T>>;
}
