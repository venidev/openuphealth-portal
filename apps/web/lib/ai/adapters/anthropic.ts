import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { AiClient, AiCompletionRequest, AiResult } from "@/lib/ai/types";

// Anthropic adapter (official SDK). Structured output is enforced with
// output_config.format so every response is schema-valid; adaptive thinking is
// on; safety refusals are surfaced as a typed error, not an exception.
//
// PHI/HIPAA: sending PHI here requires a signed BAA with Anthropic and an org
// configured for zero-retention. Until that is in place, automations must be
// fed de-identified or minimal input (see the automation layer's input mapping).
const DEFAULT_MODEL = "claude-opus-4-8";

export class AnthropicAiClient implements AiClient {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic(apiKey ? { apiKey } : {});
  }

  async complete<T>(req: AiCompletionRequest<T>): Promise<AiResult<T>> {
    try {
      // The SDK's zod helper is typed against its bundled zod; our generic
      // z.ZodType<T> is erased across that boundary, so cast here and restore T
      // on the validated output below.
      const format = zodOutputFormat(req.schema as never);
      const response = await this.client.messages.parse({
        model: req.model ?? DEFAULT_MODEL,
        max_tokens: req.maxTokens ?? 4096,
        thinking: { type: "adaptive" },
        output_config: {
          format,
          ...(req.effort ? { effort: req.effort } : {}),
        },
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
      });

      if (response.stop_reason === "refusal") {
        return {
          ok: false,
          error: { kind: "refused", message: "Request declined by safety system" },
        };
      }

      if (response.parsed_output == null) {
        return {
          ok: false,
          error: { kind: "invalid_output", message: "Model returned no schema-valid output" },
        };
      }

      return { ok: true, value: response.parsed_output as T, model: response.model };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        return {
          ok: false,
          error: { kind: "provider_error", message: `Anthropic API error ${error.status}` },
        };
      }
      return {
        ok: false,
        error: { kind: "provider_error", message: "Unexpected AI provider failure" },
      };
    }
  }
}
