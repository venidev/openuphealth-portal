import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/rbac";
import { logAudit, auditContext } from "@/lib/audit";
import { buildIcs } from "@/lib/ics";

// GET /api/provider/schedule/export — download the therapist's upcoming
// schedule as an .ics file for Google/Apple/Outlook import. Busy-only events;
// no patient-identifying content leaves the platform (see lib/ics.ts).
export async function GET(request: NextRequest) {
  const result = await withRole("therapist");
  if (result.error) return result.error;

  const { user } = result;

  const appointments = await prisma.appointment.findMany({
    where: {
      therapistId: user.id,
      status: { in: ["scheduled", "confirmed"] },
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    take: 500,
  });

  const ics = buildIcs(
    appointments.map((a) => ({
      id: a.id,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      modality: a.modality,
      isFollowUp: !!a.followUpOfId,
    }))
  );

  await logAudit({
    userId: user.id,
    userRole: user.role,
    action: "schedule.exported",
    resourceType: "Appointment",
    purpose: "operations",
    metadata: { count: appointments.length },
    ...auditContext(request),
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="openuphealth-schedule.ics"',
    },
  });
}
