import type { AiClient, AiCompletionRequest, AiResult } from "@/lib/ai/types";

// Deterministic mock adapter — the default when no API key is configured, and
// the client every automation test runs against. It never calls the network.
//
// A registry of canned responses keyed by schemaName lets tests and local dev
// exercise the full automation pipeline (validation, mapping, wiring) with
// predictable output. Unknown schemas return a safe "unavailable" so callers
// fall back to the manual path rather than fabricating data.
export class MockAiClient implements AiClient {
  readonly name = "mock";

  constructor(private readonly responses: Record<string, unknown> = {}) {}

  async complete<T>(req: AiCompletionRequest<T>): Promise<AiResult<T>> {
    if (!(req.schemaName in this.responses)) {
      return {
        ok: false,
        error: { kind: "unavailable", message: `No mock response for ${req.schemaName}` },
      };
    }
    const parsed = req.schema.safeParse(this.responses[req.schemaName]);
    if (!parsed.success) {
      return {
        ok: false,
        error: { kind: "invalid_output", message: parsed.error.message },
      };
    }
    return { ok: true, value: parsed.data, model: this.name };
  }
}
