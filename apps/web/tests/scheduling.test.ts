/**
 * OpenUpHealth – Scheduling Tests
 *
 * Follow-up appointments (ownership-enforced, conflict-checked, linked to the
 * original) and PHI-safe iCalendar export.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    appointment: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { buildIcs } from "@/lib/ics";
import type { AuthenticatedUser } from "@/lib/rbac";

const THERAPIST: AuthenticatedUser = { id: "u-thr", email: "t@t", name: "T", role: "therapist" };
const OTHER_THERAPIST: AuthenticatedUser = { id: "u-thr2", email: "t2@t", name: "T2", role: "therapist" };
const PATIENT: AuthenticatedUser = { id: "u-pat", email: "p@t", name: "P", role: "patient" };

const ORIGINAL = {
  id: "appt-1",
  patientId: "u-pat",
  therapistId: "u-thr",
  startsAt: new Date("2026-07-10T10:00:00Z"),
  endsAt: new Date("2026-07-10T10:50:00Z"),
  modality: "video",
};

function signIn(user: AuthenticatedUser | null) {
  vi.mocked(auth).mockResolvedValue(user ? ({ user } as never) : (null as never));
}
function req(body?: unknown) {
  return { url: "http://localhost/api/x", headers: new Headers(), json: async () => body } as never;
}
const params = { params: Promise.resolve({ id: "appt-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.appointment.findUnique).mockResolvedValue(ORIGINAL as never);
  vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null as never); // no conflict
  vi.mocked(prisma.appointment.create).mockImplementation(
    (async (a: { data: Record<string, unknown> }) => ({ id: "appt-fu", ...a.data })) as never
  );
});

describe("POST /api/appointments/[id]/follow-up", () => {
  const validBody = {
    startsAt: "2026-07-17T10:00:00Z",
    endsAt: "2026-07-17T10:50:00Z",
  };

  it("creates a follow-up linked to the original, inheriting patient/therapist/modality", async () => {
    const { POST } = await import("@/app/api/appointments/[id]/follow-up/route");
    signIn(THERAPIST);
    const res = (await POST(req(validBody), params)) as unknown as {
      status: number;
      body: { data: { followUpOfId: string; patientId: string; modality: string } };
    };
    expect(res.status).toBe(201);
    expect(res.body.data.followUpOfId).toBe("appt-1");
    expect(res.body.data.patientId).toBe("u-pat");
    expect(res.body.data.modality).toBe("video");
  });

  it("blocks a therapist who does not own the original appointment (403)", async () => {
    const { POST } = await import("@/app/api/appointments/[id]/follow-up/route");
    signIn(OTHER_THERAPIST);
    const res = (await POST(req(validBody), params)) as unknown as { status: number };
    expect(res.status).toBe(403);
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it("blocks patients from creating follow-ups (403)", async () => {
    const { POST } = await import("@/app/api/appointments/[id]/follow-up/route");
    signIn(PATIENT);
    const res = (await POST(req(validBody), params)) as unknown as { status: number };
    expect(res.status).toBe(403);
  });

  it("rejects a conflicting time slot with 409", async () => {
    const { POST } = await import("@/app/api/appointments/[id]/follow-up/route");
    signIn(THERAPIST);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: "appt-x" } as never);
    const res = (await POST(req(validBody), params)) as unknown as { status: number };
    expect(res.status).toBe(409);
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it("rejects an inverted time range with 400", async () => {
    const { POST } = await import("@/app/api/appointments/[id]/follow-up/route");
    signIn(THERAPIST);
    const res = (await POST(
      req({ startsAt: "2026-07-17T11:00:00Z", endsAt: "2026-07-17T10:00:00Z" }),
      params
    )) as unknown as { status: number };
    expect(res.status).toBe(400);
  });
});

describe("buildIcs (calendar export)", () => {
  const events = [
    {
      id: "appt-1",
      startsAt: new Date("2026-07-10T10:00:00Z"),
      endsAt: new Date("2026-07-10T10:50:00Z"),
      modality: "video",
      isFollowUp: false,
    },
    {
      id: "appt-2",
      startsAt: new Date("2026-07-17T10:00:00Z"),
      endsAt: new Date("2026-07-17T10:50:00Z"),
      modality: "in_person",
      isFollowUp: true,
    },
  ];

  it("produces a valid VCALENDAR with one VEVENT per appointment", () => {
    const ics = buildIcs(events);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("DTSTART:20260710T100000Z");
  });

  it("never includes patient-identifying content (PHI-safe busy blocks)", () => {
    const ics = buildIcs(events);
    // Generic titles only; follow-ups marked without any patient context.
    expect(ics).toContain("SUMMARY:OpenUp session");
    expect(ics).toContain("SUMMARY:OpenUp session (follow-up)");
    // No names/emails anywhere in the export.
    expect(ics).not.toMatch(/patient|@openuphealth\.local/i);
  });
});
