import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/rbac";
import { logAudit, auditContext } from "@/lib/audit";

// GET /api/external-providers — the refer-out directory (R3). Available to
// clinical/operational roles; contains no patient PHI.
export async function GET(request: NextRequest) {
  const result = await withRole("therapist", "care_coordinator");
  if (result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const specialty = searchParams.get("specialty");
  const state = searchParams.get("state");

  const where: Record<string, unknown> = {};
  if (specialty) where.specialty = { contains: specialty };
  if (state) where.statesServed = { contains: state };

  const providers = await prisma.externalProvider.findMany({
    where,
    orderBy: { name: "asc" },
    take: 200,
  });

  return NextResponse.json({ data: providers });
}

// POST /api/external-providers — care team maintains the directory.
export async function POST(request: NextRequest) {
  const result = await withRole("care_coordinator");
  if (result.error) return result.error;

  const { user } = result;

  try {
    const body = await request.json();
    const { name, npi, specialty, statesServed, insuranceAccepted, contact } =
      body ?? {};

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const provider = await prisma.externalProvider.create({
      data: {
        name,
        npi: npi ?? null,
        specialty: specialty ?? null,
        statesServed: Array.isArray(statesServed)
          ? JSON.stringify(statesServed)
          : statesServed ?? null,
        insuranceAccepted: Array.isArray(insuranceAccepted)
          ? JSON.stringify(insuranceAccepted)
          : insuranceAccepted ?? null,
        contact: contact ?? null,
      },
    });

    await logAudit({
      userId: user.id,
      userRole: user.role,
      action: "external_provider.created",
      resourceType: "ExternalProvider",
      resourceId: provider.id,
      purpose: "operations",
      ...auditContext(request),
    });

    return NextResponse.json({ data: provider }, { status: 201 });
  } catch (error) {
    console.error("Error creating external provider:", error);
    return NextResponse.json(
      { error: "Failed to create external provider" },
      { status: 500 }
    );
  }
}
