import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/rbac";
import { logAudit, auditContext } from "@/lib/audit";

// POST /api/appointments/[id]/follow-up — schedule a follow-up linked to an
// existing appointment. Object-level authz: a therapist may only follow up on
// their own appointment (which by definition is a patient they treat).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await withRole("therapist", "care_coordinator");
  if (result.error) return result.error;

  const { user } = result;
  const { id } = await params;

  try {
    const body = await request.json();
    const { startsAt, endsAt, modality, notes } = body ?? {};

    if (!startsAt || !endsAt) {
      return NextResponse.json(
        { error: "startsAt and endsAt are required" },
        { status: 400 }
      );
    }
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: "invalid time range" }, { status: 400 });
    }

    const original = await prisma.appointment.findUnique({ where: { id } });
    if (!original) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    if (user.role === "therapist" && original.therapistId !== user.id) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const conflicting = await prisma.appointment.findFirst({
      where: {
        therapistId: original.therapistId,
        status: { in: ["scheduled", "confirmed"] },
        startsAt: { lt: end },
        endsAt: { gt: start },
      },
    });
    if (conflicting) {
      return NextResponse.json(
        { error: "Time slot conflicts with an existing appointment" },
        { status: 409 }
      );
    }

    const followUp = await prisma.appointment.create({
      data: {
        patientId: original.patientId,
        therapistId: original.therapistId,
        startsAt: start,
        endsAt: end,
        modality: modality ?? original.modality,
        notes: notes ?? null,
        status: "scheduled",
        followUpOfId: original.id,
      },
    });

    await logAudit({
      userId: user.id,
      userRole: user.role,
      patientId: original.patientId,
      action: "appointment.follow_up_created",
      resourceType: "Appointment",
      resourceId: followUp.id,
      purpose: "treatment",
      metadata: { followUpOf: original.id },
      ...auditContext(request),
    });

    return NextResponse.json({ data: followUp }, { status: 201 });
  } catch (error) {
    console.error("Error creating follow-up:", error);
    return NextResponse.json({ error: "Failed to create follow-up" }, { status: 500 });
  }
}
