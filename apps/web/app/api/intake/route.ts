import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/rbac";
import { logAudit, auditContext } from "@/lib/audit";
import {
  getAiClient,
  runAutomation,
  intakeTriageAutomation,
  IntakeTriageInput,
} from "@/lib/ai";
import { escalateCrisis } from "@/lib/crisis";

export async function GET(request: NextRequest) {
  const result = await withRole("patient", "care_coordinator");
  if (result.error) return result.error;

  const { user } = result;

  const profile = await prisma.patientProfile.findUnique({
    where: { userId: user.id },
    include: {
      intakeForms: {
        orderBy: { completedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({ data: profile.intakeForms[0] || null });
}

export async function POST(request: NextRequest) {
  const result = await withRole("patient");
  if (result.error) return result.error;

  const { user } = result;

  try {
    const body = await request.json();

    let profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      profile = await prisma.patientProfile.create({
        data: { userId: user.id },
      });
    }

    const intake = await prisma.intakeForm.create({
      data: {
        patientId: profile.id,
        therapyGoals: body.therapyGoals ? JSON.stringify(body.therapyGoals) : null,
        preferredLanguage: body.preferredLanguage,
        specialtyPreferences: body.specialtyPreferences
          ? JSON.stringify(body.specialtyPreferences)
          : null,
        availability: body.availability ? JSON.stringify(body.availability) : null,
        careFormat: body.careFormat,
        paymentPreference: body.paymentPreference,
        additionalNotes: body.additionalNotes,
        completedAt: new Date(),
      },
    });

    await prisma.patientProfile.update({
      where: { id: profile.id },
      data: { intakeCompletedAt: new Date() },
    });

    await logAudit({
      userId: user.id,
      userRole: user.role,
      patientId: profile.id,
      action: "intake.submitted",
      resourceType: "IntakeForm",
      resourceId: intake.id,
      purpose: "treatment",
      ...auditContext(request),
    });

    // AI automation: triage the intake for the coordinator queue. Fail-safe —
    // if the AI layer is unavailable or declines, intake still succeeds and the
    // coordinator does manual triage.
    const triageInput = IntakeTriageInput.parse({
      therapyGoals: body.therapyGoals ?? [],
      specialtyPreferences: body.specialtyPreferences ?? [],
      preferredLanguage: body.preferredLanguage,
      careFormat: body.careFormat,
      additionalNotes: body.additionalNotes,
    });
    const triage = await runAutomation(getAiClient(), intakeTriageAutomation, triageInput);

    let triageResult = null;
    if (triage.ok) {
      triageResult = triage.value;
      await prisma.intakeForm.update({
        where: { id: intake.id },
        data: { triageJson: JSON.stringify(triage.value) },
      });
      await logAudit({
        userId: user.id,
        userRole: user.role,
        patientId: profile.id,
        action: "intake.triaged",
        resourceType: "IntakeForm",
        resourceId: intake.id,
        purpose: "operations",
        metadata: { urgency: triage.value.urgency, model: triage.model },
      });
      // Crisis-safety: an AI crisis flag routes into the same escalation path.
      if (triage.value.urgency === "urgent" || triage.value.riskFlags.includes("crisis_review")) {
        await escalateCrisis({
          patientProfileId: profile.id,
          patientUserId: user.id,
          assessmentId: intake.id,
          signal: "Intake triage flagged elevated risk",
        });
      }
    }

    return NextResponse.json({ data: intake, triage: triageResult }, { status: 201 });
  } catch (error) {
    console.error("Error creating intake:", error);
    return NextResponse.json({ error: "Failed to submit intake form" }, { status: 500 });
  }
}
