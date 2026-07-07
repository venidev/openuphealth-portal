import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/rbac";

// GET /api/patient/disclosures — HIPAA accounting of disclosures
// (PRODUCT_SCOPE Privacy Rule). Shows the patient disclosures of their PHI
// outside treatment/payment/operations. Self-scoped.
export async function GET() {
  const result = await withRole("patient");
  if (result.error) return result.error;

  const { user } = result;

  const disclosures = await prisma.disclosureRecord.findMany({
    where: { patientId: user.id },
    orderBy: { disclosedAt: "desc" },
    take: 500,
  });

  return NextResponse.json({ data: disclosures });
}
