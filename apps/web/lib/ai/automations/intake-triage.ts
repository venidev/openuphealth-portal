import { z } from "zod";
import type { Automation } from "@/lib/ai/automations/automation";

// Automation: triage a patient intake submission for the care-coordinator queue.
// Automates the manual first-pass a coordinator does — urgency, suggested
// specialties, a one-line summary — so routing is faster. Output is advisory:
// a human coordinator always confirms (human-in-the-loop).

export const IntakeTriageInput = z.object({
  therapyGoals: z.array(z.string()).default([]),
  specialtyPreferences: z.array(z.string()).default([]),
  preferredLanguage: z.string().nullish(),
  careFormat: z.string().nullish(),
  additionalNotes: z.string().nullish(),
});
export type IntakeTriageInput = z.infer<typeof IntakeTriageInput>;

export const IntakeTriageOutput = z.object({
  urgency: z.enum(["routine", "elevated", "urgent"]),
  suggestedSpecialties: z.array(z.string()),
  riskFlags: z.array(z.string()),
  summary: z.string(),
});
export type IntakeTriageOutput = z.infer<typeof IntakeTriageOutput>;

export const intakeTriageAutomation: Automation<IntakeTriageInput, IntakeTriageOutput> = {
  name: "intake_triage",
  outputSchema: IntakeTriageOutput,
  effort: "low",
  maxTokens: 1024,

  system() {
    return [
      "You are a clinical intake triage assistant for a mental-health platform.",
      "Classify an intake submission to help a human care coordinator route it.",
      "Rules:",
      "- Your output is ADVISORY. A human coordinator makes the final decision.",
      "- Set urgency to 'urgent' only for explicit indications of crisis, self-harm,",
      "  or risk of harm to self or others. Otherwise 'elevated' or 'routine'.",
      "- riskFlags: short phrases for anything a coordinator should personally review.",
      "  If a crisis/self-harm indication is present, include 'crisis_review'.",
      "- Never fabricate clinical detail. Base everything on the provided text.",
      "- summary: one neutral sentence, no diagnosis.",
    ].join("\n");
  },

  buildPrompt(input) {
    return [
      "Intake submission:",
      `Goals: ${input.therapyGoals.join("; ") || "(none)"}`,
      `Requested specialties: ${input.specialtyPreferences.join("; ") || "(none)"}`,
      `Preferred language: ${input.preferredLanguage ?? "(unspecified)"}`,
      `Care format: ${input.careFormat ?? "(unspecified)"}`,
      `Additional notes: ${input.additionalNotes ?? "(none)"}`,
    ].join("\n");
  },
};
