import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/rbac";
import { resolvePatientAccess } from "@/lib/authz";

export async function GET(request: NextRequest) {
  const result = await withRole("patient", "therapist", "care_coordinator");
  if (result.error) return result.error;

  const { user } = result;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "30");
  const patientId = searchParams.get("patientId");

  // Object-level authz: never return unscoped data; therapists only their own
  // patients. MoodCheckin.patientId is a User id.
  const access = await resolvePatientAccess(user, patientId);
  if ("error" in access) return access.error;

  const where: Record<string, unknown> = { patientId: access.patientUserId };

  const [checkins, total] = await Promise.all([
    prisma.moodCheckin.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.moodCheckin.count({ where }),
  ]);

  return NextResponse.json({ data: checkins, total, page, limit });
}

export async function POST(request: NextRequest) {
  const result = await withRole("patient");
  if (result.error) return result.error;

  const { user } = result;

  try {
    const body = await request.json();
    const { moodScore, journalText } = body;

    if (moodScore === undefined || moodScore < 1 || moodScore > 10) {
      return NextResponse.json(
        { error: "moodScore (1-10) is required" },
        { status: 400 }
      );
    }

    const checkin = await prisma.moodCheckin.create({
      data: {
        patientId: user.id,
        moodScore,
        journalText,
      },
    });

    return NextResponse.json({ data: checkin }, { status: 201 });
  } catch (error) {
    console.error("Error creating mood checkin:", error);
    return NextResponse.json({ error: "Failed to create mood checkin" }, { status: 500 });
  }
}
