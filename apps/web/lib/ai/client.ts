import type { AiClient } from "@/lib/ai/types";
import { MockAiClient } from "@/lib/ai/adapters/mock";
import { AnthropicAiClient } from "@/lib/ai/adapters/anthropic";

// Client factory (composition root for the AI layer).
//
// Fail-safe default: without ANTHROPIC_API_KEY *and* the AI_AUTOMATION_ENABLED
// flag, automations run against the mock, which returns "unavailable" for
// unknown inputs — so a misconfigured environment degrades to the manual
// workflow instead of calling a provider with PHI by accident.
let cached: AiClient | null = null;

export function getAiClient(): AiClient {
  if (cached) return cached;

  const enabled = process.env.AI_AUTOMATION_ENABLED === "true";
  const apiKey = process.env.ANTHROPIC_API_KEY;

  cached = enabled && apiKey ? new AnthropicAiClient(apiKey) : new MockAiClient();
  return cached;
}

// For tests / DI: override the process-wide client.
export function setAiClient(client: AiClient): void {
  cached = client;
}
