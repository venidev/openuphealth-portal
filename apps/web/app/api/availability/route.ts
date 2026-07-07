import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const user = await withAuth();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const therapistId = searchParams.get("therapistId");

  if (!therapistId) {
    return NextResponse.json({ error: "therapistId is required" }, { status: 400 });
  }

  const profile = await prisma.therapistProfile.findUnique({
    where: { userId: therapistId },
  });

  if (!profile) {
    return NextResponse.json({ error: "Therapist not found" }, { status: 404 });
  }

  const slots = await prisma.availabilitySlot.findMany({
    where: { therapistId: profile.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ data: slots });
}

export async function POST(request: NextRequest) {
  const user = await withAuth();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (user.role !== "therapist" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { slots } = body;

    // An empty array is valid: it clears the therapist's availability.
    if (!Array.isArray(slots)) {
      return NextResponse.json({ error: "slots array is required" }, { status: 400 });
    }

    const profile = await prisma.therapistProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Therapist profile not found" }, { status: 404 });
    }

    await prisma.availabilitySlot.deleteMany({
      where: { therapistId: profile.id },
    });

    const created = await prisma.availabilitySlot.createMany({
      data: slots.map((slot: { dayOfWeek: number; startTime: string; endTime: string; isRecurring?: boolean }) => ({
        therapistId: profile.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isRecurring: slot.isRecurring ?? true,
      })),
    });

    return NextResponse.json({ data: { count: created.count } }, { status: 201 });
  } catch (error) {
    console.error("Error creating availability:", error);
    return NextResponse.json({ error: "Failed to update availability" }, { status: 500 });
  }
}
