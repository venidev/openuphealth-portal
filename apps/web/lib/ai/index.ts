// AI automation layer — public surface.
//
// Every AI-driven process automation in the product is registered here. To add
// one: implement an Automation and add it to the registry. Nothing else in the
// codebase calls a provider SDK directly.

export type { AiClient, AiResult, AiError, AiCompletionRequest } from "@/lib/ai/types";
export { getAiClient, setAiClient } from "@/lib/ai/client";
export { runAutomation, type Automation } from "@/lib/ai/automations/automation";

import { intakeTriageAutomation } from "@/lib/ai/automations/intake-triage";
import { referralTriageAutomation } from "@/lib/ai/automations/referral-triage";

export * from "@/lib/ai/automations/intake-triage";
export * from "@/lib/ai/automations/referral-triage";

// Registry — the catalog of automations, keyed by name.
export const automations = {
  [intakeTriageAutomation.name]: intakeTriageAutomation,
  [referralTriageAutomation.name]: referralTriageAutomation,
} as const;
