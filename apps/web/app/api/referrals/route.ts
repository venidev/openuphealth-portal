import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/rbac";
import { logAudit, auditContext } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { therapistTreatsPatient } from "@/lib/authz";
import {
  REFERRAL_TYPES,
  REFERRAL_URGENCIES,
  type ReferralType,
} from "@/lib/referrals";

// GET /api/referrals — role-scoped list.
//  - care_coordinator / super_admin: the full triage queue
//  - therapist: referrals they created
//  - patient: their own referrals
export async function GET(request: NextRequest) {
  const result = await withRole(
    "patient",
    "therapist",
    "care_coordinator"
  );
  if (result.error) return result.error;

  const { user } = result;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;

  if (user.role === "patient") {
    where.patientId = user.id;
  } else if (user.role === "therapist") {
    where.createdById = user.id;
  }
  // care_coordinator and super_admin see the whole queue.

  const referrals = await prisma.referral.findMany({
    where,
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({ data: referrals });
}

// POST /api/referrals — create a referral.
export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, {
    key: "referrals",
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const result = await withRole("patient", "therapist", "care_coordinator");
  if (result.error) return result.error;

  const { user } = result;
  const ctx = auditContext(request);

  try {
    const body = await request.json();
    const {
      type,
      patientId,
      reason,
      urgency,
      externalProviderId,
      referringProvider,
      referringNpi,
      referringOrg,
      idempotencyKey,
    } = body ?? {};

    if (!REFERRAL_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${REFERRAL_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (urgency && !REFERRAL_URGENCIES.includes(urgency)) {
      return NextResponse.json(
        { error: `urgency must be one of: ${REFERRAL_URGENCIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Authorization by type/role.
    const referralType = type as ReferralType;
    let resolvedPatientId: string | null = patientId ?? null;

    if (user.role === "patient") {
      // Patients may only request their own rematch (internal transfer).
      if (referralType !== "internal_transfer") {
        return NextResponse.json(
          { error: "Patients may only request a therapist rematch" },
          { status: 403 }
        );
      }
      resolvedPatientId = user.id;
    } else if (user.role === "therapist") {
      // Therapists refer out / transfer only their own patients.
      if (referralType === "inbound") {
        return NextResponse.json(
          { error: "Therapists cannot create inbound referrals" },
          { status: 403 }
        );
      }
      if (!resolvedPatientId) {
        return NextResponse.json(
          { error: "patientId is required" },
          { status: 400 }
        );
      }
      const treats = await therapistTreatsPatient(user.id, resolvedPatientId);
      if (!treats) {
        return NextResponse.json(
          { error: "No treatment relationship with this patient" },
          { status: 403 }
        );
      }
    }
    // care_coordinator / super_admin may create any referral type.

    // Idempotency: replaying the same key returns the original referral.
    if (idempotencyKey) {
      const existing = await prisma.referral.findFirst({
        where: { idempotencyKey },
      });
      if (existing) {
        return NextResponse.json({ data: existing }, { status: 200 });
      }
    }

    const referral = await prisma.referral.create({
      data: {
        type: referralType,
        status: "received",
        patientId: resolvedPatientId,
        reason: reason ?? null,
        urgency: urgency ?? "routine",
        externalProviderId: externalProviderId ?? null,
        referringProvider: referringProvider ?? null,
        referringNpi: referringNpi ?? null,
        referringOrg: referringOrg ?? null,
        idempotencyKey: idempotencyKey ?? null,
        createdById: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      userRole: user.role,
      patientId: resolvedPatientId ?? undefined,
      action: "referral.created",
      resourceType: "Referral",
      resourceId: referral.id,
      purpose: "treatment",
      metadata: { type: referralType, urgency: referral.urgency },
      ...ctx,
    });

    return NextResponse.json({ data: referral }, { status: 201 });
  } catch (error) {
    console.error("Error creating referral:", error);
    return NextResponse.json(
      { error: "Failed to create referral" },
      { status: 500 }
    );
  }
}
