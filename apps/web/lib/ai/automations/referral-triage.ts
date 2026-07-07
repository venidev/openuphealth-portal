import { z } from "zod";
import type { Automation } from "@/lib/ai/automations/automation";

// Automation: triage an inbound referral for the coordinator queue (R1).
// Automates urgency assessment and a normalized reason from free-text referral
// notes. Advisory — a coordinator confirms before any patient outreach.

export const ReferralTriageInput = z.object({
  reason: z.string().nullish(),
  referringOrg: z.string().nullish(),
  notes: z.string().nullish(),
});
export type ReferralTriageInput = z.infer<typeof ReferralTriageInput>;

export const ReferralTriageOutput = z.object({
  urgency: z.enum(["routine", "urgent", "crisis"]),
  normalizedReason: z.string(),
  recommendedActionWithinHours: z.number().int().positive(),
});
export type ReferralTriageOutput = z.infer<typeof ReferralTriageOutput>;

export const referralTriageAutomation: Automation<ReferralTriageInput, ReferralTriageOutput> = {
  name: "referral_triage",
  outputSchema: ReferralTriageOutput,
  effort: "low",
  maxTokens: 1024,

  system() {
    return [
      "You triage inbound clinical referrals for a mental-health platform.",
      "Rules:",
      "- Output is ADVISORY; a human coordinator confirms before outreach.",
      "- urgency 'crisis' only for explicit crisis/self-harm/safety indications.",
      "- recommendedActionWithinHours: 2 for crisis, 24 for urgent, 48 for routine.",
      "- normalizedReason: one concise clinical reason phrase, no diagnosis or fabrication.",
    ].join("\n");
  },

  buildPrompt(input) {
    return [
      "Inbound referral:",
      `Reason: ${input.reason ?? "(none)"}`,
      `Referring organization: ${input.referringOrg ?? "(unknown)"}`,
      `Notes: ${input.notes ?? "(none)"}`,
    ].join("\n");
  },
};
