import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/rbac";
import { logAudit, auditContext } from "@/lib/audit";

// GET /api/patient/export — HIPAA Right of Access (PRODUCT_SCOPE Privacy Rule).
// Returns the patient's designated record set as a portable JSON document.
// Strictly self-scoped: a patient can export only their own record.
export async function GET(request: NextRequest) {
  const result = await withRole("patient");
  if (result.error) return result.error;

  const { user } = result;

  const profile = await prisma.patientProfile.findUnique({
    where: { userId: user.id },
  });

  const profileId = profile?.id;

  // Gather across the record set. MoodCheckin/Appointment/Invoice key on User
  // id; Assessment/IntakeForm/Insurance key on PatientProfile id.
  const [
    appointments,
    assessments,
    moodCheckins,
    invoices,
    intakeForms,
    insurance,
    consents,
    threads,
  ] = await Promise.all([
    prisma.appointment.findMany({ where: { patientId: user.id }, orderBy: { startsAt: "desc" } }),
    profileId
      ? prisma.assessment.findMany({ where: { patientId: profileId }, orderBy: { completedAt: "desc" } })
      : Promise.resolve([]),
    prisma.moodCheckin.findMany({ where: { patientId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.invoice.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    profileId
      ? prisma.intakeForm.findMany({ where: { patientId: profileId }, orderBy: { completedAt: "desc" } })
      : Promise.resolve([]),
    profileId
      ? prisma.insuranceInfo.findMany({ where: { patientId: profileId } })
      : Promise.resolve([]),
    prisma.consent.findMany({ where: { userId: user.id }, orderBy: { grantedAt: "desc" } }),
    prisma.messageThread.findMany({
      where: { participantIds: { contains: user.id } },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }),
  ]);

  const record = {
    exportedAt: new Date().toISOString(),
    patient: {
      id: user.id,
      email: user.email,
      name: user.name,
      dateOfBirth: profile?.dateOfBirth ?? null,
      phone: profile?.phone ?? null,
    },
    appointments,
    assessments,
    moodCheckins,
    invoices,
    intakeForms,
    insurance,
    consents,
    messageThreads: threads,
  };

  await logAudit({
    userId: user.id,
    userRole: user.role,
    patientId: user.id,
    action: "record.exported",
    resourceType: "PatientRecord",
    purpose: "patient-request",
    ...auditContext(request),
  });

  return NextResponse.json(record, {
    headers: {
      "Content-Disposition": `attachment; filename="openuphealth-record-${user.id}.json"`,
    },
  });
}
