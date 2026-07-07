import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

// Clinical-safety gate (PRODUCT_SCOPE "PHQ-9 item 9 crisis escalation").
// PHQ-9 question 9 ("thoughts that you would be better off dead, or of hurting
// yourself") is index 8 in a 0-based responses array. ANY non-zero answer is a
// suicidality signal that must be escalated immediately.
const PHQ9_ITEM9_INDEX = 8;

export function detectCrisis(
  type: string,
  responses: unknown
): { isCrisis: boolean; signal?: string } {
  if (type === "PHQ-9" && Array.isArray(responses)) {
    const item9 = Number(responses[PHQ9_ITEM9_INDEX]);
    if (!Number.isNaN(item9) && item9 > 0) {
      return { isCrisis: true, signal: "PHQ-9 item 9 positive (suicidality)" };
    }
  }
  return { isCrisis: false };
}

// Escalate a positive suicidality signal: create an elevated CareCase for the
// care team. Returns whether a case was created so the caller can surface
// crisis resources to the patient regardless.
export async function escalateCrisis(params: {
  patientProfileId: string;
  patientUserId: string;
  assessmentId: string;
  signal: string;
}): Promise<{ caseCreated: boolean; caseId?: string }> {
  // Assign to an available care coordinator. If none exists yet, we still
  // audit the signal so it is never silently lost.
  const coordinator = await prisma.user.findFirst({
    where: { role: "care_coordinator" },
    select: { id: true },
  });

  let caseId: string | undefined;
  if (coordinator) {
    const careCase = await prisma.careCase.create({
      data: {
        patientId: params.patientProfileId,
        coordinatorId: coordinator.id,
        status: "open",
        priority: 3, // urgent
        notes: JSON.stringify([
          {
            at: new Date().toISOString(),
            system: true,
            note: `Auto-escalated: ${params.signal} on assessment ${params.assessmentId}.`,
          },
        ]),
      },
    });
    caseId = careCase.id;
  }

  await logAudit({
    userId: params.patientUserId,
    userRole: "patient",
    patientId: params.patientProfileId,
    action: "crisis.escalated",
    resourceType: "Assessment",
    resourceId: params.assessmentId,
    purpose: "treatment",
    success: !!coordinator,
    metadata: { signal: params.signal, caseCreated: !!coordinator },
  });

  return { caseCreated: !!coordinator, caseId };
}
