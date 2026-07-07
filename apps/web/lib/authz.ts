import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import type { AuthenticatedUser } from "@/lib/rbac";

// Object-level authorization (PRODUCT_SCOPE T6). Role gates alone are not
// enough: a therapist has the "therapist" role for ALL patients, so every
// route that exposes a specific patient's PHI must additionally verify a
// treatment/operational relationship to THAT patient.

// True when a treatment relationship exists between therapist and patient
// (identified by User ids), evidenced by a shared appointment.
export async function therapistTreatsPatient(
  therapistUserId: string,
  patientUserId: string
): Promise<boolean> {
  const appt = await prisma.appointment.findFirst({
    where: { therapistId: therapistUserId, patientId: patientUserId },
    select: { id: true },
  });
  return !!appt;
}

// Resolves and authorizes which patient (by User id) a request may read.
// - patient: forced to self; any supplied id is ignored.
// - therapist: must supply an id AND have a treatment relationship.
// - care_coordinator / super_admin: operational; must supply an explicit id
//   (never an unscoped "all patients" query).
// Returns either the authorized patient User id or a NextResponse error.
export async function resolvePatientAccess(
  user: AuthenticatedUser,
  requestedPatientUserId: string | null
): Promise<{ patientUserId: string } | { error: NextResponse }> {
  if (user.role === "patient") {
    return { patientUserId: user.id };
  }

  if (!requestedPatientUserId) {
    return {
      error: NextResponse.json(
        { error: "patientId is required" },
        { status: 400 }
      ),
    };
  }

  if (user.role === "therapist") {
    const allowed = await therapistTreatsPatient(user.id, requestedPatientUserId);
    if (!allowed) {
      return {
        error: NextResponse.json(
          { error: "No treatment relationship with this patient" },
          { status: 403 }
        ),
      };
    }
  }

  // care_coordinator and super_admin: allowed with an explicit patient id.
  return { patientUserId: requestedPatientUserId };
}
