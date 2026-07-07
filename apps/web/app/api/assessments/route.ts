import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/rbac";
import { logAudit, auditContext } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { detectCrisis, escalateCrisis } from "@/lib/crisis";

export async function GET(request: NextRequest) {
  const result = await withRole("patient", "therapist", "care_coordinator");
  if (result.error) return result.error;

  const { user } = result;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const patientUserId = searchParams.get("patientId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  let patientProfileId: string | undefined;

  if (user.role === "patient") {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) return NextResponse.json({ data: [], total: 0 });
    patientProfileId = profile.id;
  } else if (patientUserId) {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId: patientUserId },
    });
    if (!profile) return NextResponse.json({ data: [], total: 0 });
    patientProfileId = profile.id;
  }

  const where: Record<string, unknown> = {};
  if (patientProfileId) where.patientId = patientProfileId;
  if (type) where.type = type;

  const [assessments, total] = await Promise.all([
    prisma.assessment.findMany({
      where,
      orderBy: { completedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.assessment.count({ where }),
  ]);

  return NextResponse.json({ data: assessments, total, page, limit });
}

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, {
    key: "assessments",
    limit: 20,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const result = await withRole("patient");
  if (result.error) return result.error;

  const { user } = result;
  const ctx = auditContext(request);

  try {
    const body = await request.json();
    const { type, score, responses } = body;

    if (!type || score === undefined) {
      return NextResponse.json(
        { error: "type and score are required" },
        { status: 400 }
      );
    }

    const profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });
    }

    const assessment = await prisma.assessment.create({
      data: {
        patientId: profile.id,
        type,
        score,
        responses: responses ? JSON.stringify(responses) : null,
        completedAt: new Date(),
      },
    });

    await logAudit({
      userId: user.id,
      userRole: user.role,
      patientId: profile.id,
      action: "assessment.completed",
      resourceType: "Assessment",
      resourceId: assessment.id,
      purpose: "treatment",
      metadata: { type, score },
      ...ctx,
    });

    // Clinical-safety gate: escalate a positive PHQ-9 suicidality signal and
    // tell the client to surface crisis resources in-flow.
    const crisis = detectCrisis(type, responses);
    if (crisis.isCrisis) {
      await escalateCrisis({
        patientProfileId: profile.id,
        patientUserId: user.id,
        assessmentId: assessment.id,
        signal: crisis.signal!,
      });
      return NextResponse.json(
        { data: assessment, crisis: { escalated: true, signal: crisis.signal } },
        { status: 201 }
      );
    }

    return NextResponse.json({ data: assessment }, { status: 201 });
  } catch (error) {
    console.error("Error creating assessment:", error);
    return NextResponse.json({ error: "Failed to create assessment" }, { status: 500 });
  }
}
