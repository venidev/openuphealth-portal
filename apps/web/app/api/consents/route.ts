import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/rbac";
import { logAudit, auditContext } from "@/lib/audit";
import {
  CONSENT_TYPES,
  CONSENT_CHANNELS,
  NPP_VERSION,
  type ConsentType,
} from "@/lib/consent";

// GET /api/consents — the caller's own consent history (versioned, append-only).
export async function GET() {
  const user = await withAuth();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const consents = await prisma.consent.findMany({
    where: { userId: user.id },
    orderBy: { grantedAt: "desc" },
  });

  // Surface which consents are currently active (granted, not revoked).
  const active = new Set(
    consents.filter((c) => !c.revokedAt).map((c) => c.type)
  );

  return NextResponse.json({
    data: consents,
    active: Array.from(active),
    currentNppVersion: NPP_VERSION,
  });
}

// POST /api/consents — grant/acknowledge or revoke a consent for the caller.
// Never overwrites: a grant creates a row; a revoke stamps revokedAt on the
// active row of that type.
export async function POST(request: NextRequest) {
  const user = await withAuth();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, channel, revoke } = body ?? {};

    if (!CONSENT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${CONSENT_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (channel && !CONSENT_CHANNELS.includes(channel)) {
      return NextResponse.json({ error: "invalid channel" }, { status: 400 });
    }

    const consentType = type as ConsentType;

    if (revoke) {
      await prisma.consent.updateMany({
        where: { userId: user.id, type: consentType, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await logAudit({
        userId: user.id,
        userRole: user.role,
        patientId: user.id,
        action: "consent.revoked",
        resourceType: "Consent",
        purpose: "patient-request",
        metadata: { type: consentType },
        ...auditContext(request),
      });
      return NextResponse.json({ data: { type: consentType, revoked: true } });
    }

    const consent = await prisma.consent.create({
      data: {
        userId: user.id,
        type: consentType,
        documentVersion:
          consentType === "notice-of-privacy-practices" ? NPP_VERSION : "1.0",
        channel: channel ?? null,
      },
    });

    await logAudit({
      userId: user.id,
      userRole: user.role,
      patientId: user.id,
      action: "consent.granted",
      resourceType: "Consent",
      resourceId: consent.id,
      purpose: "patient-request",
      metadata: { type: consentType, version: consent.documentVersion },
      ...auditContext(request),
    });

    return NextResponse.json({ data: consent }, { status: 201 });
  } catch (error) {
    console.error("Error recording consent:", error);
    return NextResponse.json({ error: "Failed to record consent" }, { status: 500 });
  }
}
