import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/rbac";
import { logAudit, auditContext } from "@/lib/audit";
import {
  isValidTransition,
  REFERRAL_STATUSES,
  type ReferralStatus,
} from "@/lib/referrals";

// PATCH /api/referrals/[id] — advance a referral's status through the
// lifecycle. Triage is a care-team operation.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await withRole("care_coordinator");
  if (result.error) return result.error;

  const { user } = result;
  const { id } = await params;

  try {
    const body = await request.json();
    const { status } = body ?? {};

    if (!REFERRAL_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${REFERRAL_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await prisma.referral.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    }

    const from = existing.status as ReferralStatus;
    const to = status as ReferralStatus;

    if (from !== to && !isValidTransition(from, to)) {
      return NextResponse.json(
        { error: `Invalid status transition: ${from} -> ${to}` },
        { status: 409 }
      );
    }

    const updated = await prisma.referral.update({
      where: { id },
      data: { status: to },
    });

    await logAudit({
      userId: user.id,
      userRole: user.role,
      patientId: existing.patientId ?? undefined,
      action: "referral.status_changed",
      resourceType: "Referral",
      resourceId: id,
      purpose: "operations",
      metadata: { from, to },
      ...auditContext(request),
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating referral:", error);
    return NextResponse.json(
      { error: "Failed to update referral" },
      { status: 500 }
    );
  }
}
