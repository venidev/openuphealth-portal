import type { z } from "zod";
import type { AiClient, AiEffort, AiResult } from "@/lib/ai/types";

// The Automation abstraction (Strategy pattern).
//
// An automation is a single, self-contained unit of AI-driven process
// automation: typed input → typed, schema-validated output. It owns its schema,
// its prompt, and its model/effort policy; it does NOT own the AI client (that
// is injected), which is what makes each automation a pure, testable function
// of (input, client).
//
// This is the "don't sprinkle AI" contract: every AI touchpoint in the product
// is registered here as a named automation with an explicit input/output
// schema, rather than an ad-hoc SDK call embedded in a route.
export interface Automation<Input, Output> {
  /** Stable identifier — also used as the structured-output schema name. */
  readonly name: string;
  /** Schema the model output must satisfy. */
  readonly outputSchema: z.ZodType<Output>;
  readonly model?: string;
  readonly effort?: AiEffort;
  readonly maxTokens?: number;
  /** System prompt: role, rules, and clinical/safety guardrails. */
  system(): string;
  /** Map typed input to the task prompt. Do minimum-necessary input shaping here. */
  buildPrompt(input: Input): string;
}

// Runs an automation against a client. Never throws for expected failure modes —
// returns the AiResult so callers fall back to the manual workflow.
export async function runAutomation<Input, Output>(
  client: AiClient,
  automation: Automation<Input, Output>,
  input: Input
): Promise<AiResult<Output>> {
  return client.complete<Output>({
    system: automation.system(),
    prompt: automation.buildPrompt(input),
    schema: automation.outputSchema,
    schemaName: automation.name,
    model: automation.model,
    effort: automation.effort,
    maxTokens: automation.maxTokens,
  });
}
