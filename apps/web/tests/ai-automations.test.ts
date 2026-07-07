/**
 * OpenUpHealth – AI Automation Layer Tests
 *
 * Proves the AI infrastructure: automations are pure, testable functions of
 * (input, client); output is schema-validated; and every failure mode (missing
 * provider, malformed output) degrades safely to a typed error rather than
 * throwing or fabricating data. No network is touched.
 */

import { describe, it, expect } from "vitest";
import { MockAiClient } from "@/lib/ai/adapters/mock";
import { runAutomation } from "@/lib/ai/automations/automation";
import {
  intakeTriageAutomation,
  IntakeTriageInput,
} from "@/lib/ai/automations/intake-triage";
import { referralTriageAutomation } from "@/lib/ai/automations/referral-triage";

describe("Automation contract", () => {
  it("returns a schema-valid result from a canned response", async () => {
    const client = new MockAiClient({
      intake_triage: {
        urgency: "routine",
        suggestedSpecialties: ["anxiety"],
        riskFlags: [],
        summary: "Seeking help with work stress.",
      },
    });

    const result = await runAutomation(client, intakeTriageAutomation, {
      therapyGoals: ["manage work stress"],
      specialtyPreferences: ["anxiety"],
    } as never);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.urgency).toBe("routine");
      expect(result.value.suggestedSpecialties).toContain("anxiety");
    }
  });

  it("degrades to a typed 'unavailable' error when the provider has no response (fail-safe)", async () => {
    const client = new MockAiClient(); // empty registry
    const result = await runAutomation(client, intakeTriageAutomation, {
      therapyGoals: [],
      specialtyPreferences: [],
    } as never);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("unavailable");
  });

  it("rejects output that violates the schema as 'invalid_output' (never fabricates)", async () => {
    const client = new MockAiClient({
      intake_triage: { urgency: "NOT_A_VALID_ENUM", suggestedSpecialties: [], riskFlags: [], summary: "x" },
    });
    const result = await runAutomation(client, intakeTriageAutomation, {
      therapyGoals: [],
      specialtyPreferences: [],
    } as never);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("invalid_output");
  });

  it("passes the automation name through as the structured-output schema name", async () => {
    // Guards the wiring that keeps schema names stable for provider-side caching.
    expect(intakeTriageAutomation.name).toBe("intake_triage");
    expect(referralTriageAutomation.name).toBe("referral_triage");
  });
});

describe("Automation prompt construction", () => {
  it("intake triage builds a prompt from minimal-necessary fields", () => {
    const prompt = intakeTriageAutomation.buildPrompt(
      IntakeTriageInput.parse({ therapyGoals: ["sleep"], specialtyPreferences: [] })
    );
    expect(prompt).toContain("sleep");
    expect(intakeTriageAutomation.system()).toContain("ADVISORY");
  });

  it("referral triage validates and maps its output shape", async () => {
    const client = new MockAiClient({
      referral_triage: { urgency: "urgent", normalizedReason: "medication eval", recommendedActionWithinHours: 24 },
    });
    const result = await runAutomation(client, referralTriageAutomation, {
      reason: "needs psychiatry",
    } as never);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.recommendedActionWithinHours).toBe(24);
  });
});
