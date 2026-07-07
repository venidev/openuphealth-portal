/**
 * OpenUpHealth – Object-Level Authorization Tests (PRODUCT_SCOPE T6)
 *
 * Proves the IDOR fixes on PHI reads: a therapist cannot reach a patient who
 * is not theirs, non-patient roles cannot run unscoped "all patients" queries,
 * and patients are always confined to their own records.
 *
 * Covers:
 *   1. resolvePatientAccess() + therapistTreatsPatient() — lib/authz.ts
 *   2. GET /api/mood                — end-to-end authz behavior
 *   3. GET /api/assessments         — end-to-end authz behavior
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Override the global @/lib/db mock: our routes import `prisma`, not `db`.
vi.mock("@/lib/db", () => ({
  prisma: {
    appointment: { findFirst: vi.fn() },
    patientProfile: { findUnique: vi.fn() },
    moodCheckin: { findMany: vi.fn(), count: vi.fn() },
    assessment: { findMany: vi.fn(), count: vi.fn() },
    careCase: { create: vi.fn() },
    user: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  resolvePatientAccess,
  therapistTreatsPatient,
} from "@/lib/authz";
import type { AuthenticatedUser } from "@/lib/rbac";

const PATIENT: AuthenticatedUser = {
  id: "user-patient-1",
  email: "p1@test.local",
  name: "Patient One",
  role: "patient",
};
const THERAPIST: AuthenticatedUser = {
  id: "user-therapist-1",
  email: "t1@test.local",
  name: "Therapist One",
  role: "therapist",
};
const COORDINATOR: AuthenticatedUser = {
  id: "user-coord-1",
  email: "c1@test.local",
  name: "Coord One",
  role: "care_coordinator",
};
const SUPERADMIN: AuthenticatedUser = {
  id: "user-admin-1",
  email: "a1@test.local",
  name: "Admin One",
  role: "super_admin",
};

// Drive rbac's withRole/withAuth by controlling the mocked auth() session.
function signIn(user: AuthenticatedUser | null) {
  vi.mocked(auth).mockResolvedValue(
    user ? ({ user } as never) : (null as never)
  );
}

function makeRequest(patientId?: string) {
  const url = patientId
    ? `http://localhost/api/x?patientId=${patientId}`
    : `http://localhost/api/x`;
  return { url, headers: new Headers() } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.moodCheckin.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.moodCheckin.count).mockResolvedValue(0 as never);
  vi.mocked(prisma.assessment.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.assessment.count).mockResolvedValue(0 as never);
});

// ---------------------------------------------------------------------------
// 1. resolvePatientAccess() — the security-critical decision function
// ---------------------------------------------------------------------------

describe("resolvePatientAccess()", () => {
  it("confines a patient to their own id, ignoring any requested id", async () => {
    const res = await resolvePatientAccess(PATIENT, "user-patient-999");
    expect(res).toEqual({ patientUserId: PATIENT.id });
    // No relationship lookup needed for self-access.
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a non-patient role that supplies no patientId (no unscoped query)", async () => {
    const res = await resolvePatientAccess(THERAPIST, null);
    expect("error" in res).toBe(true);
    if ("error" in res) expect(res.error.status).toBe(400);
  });

  it("allows a therapist WITH a treatment relationship", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: "appt-1" } as never);
    const res = await resolvePatientAccess(THERAPIST, "user-patient-1");
    expect(res).toEqual({ patientUserId: "user-patient-1" });
  });

  it("denies a therapist WITHOUT a treatment relationship (403)", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null as never);
    const res = await resolvePatientAccess(THERAPIST, "user-patient-2");
    expect("error" in res).toBe(true);
    if ("error" in res) expect(res.error.status).toBe(403);
  });

  it("allows a care_coordinator with an explicit patientId (operational role)", async () => {
    const res = await resolvePatientAccess(COORDINATOR, "user-patient-3");
    expect(res).toEqual({ patientUserId: "user-patient-3" });
    // Coordinators are not gated on a treatment relationship.
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
  });

  it("allows super_admin with an explicit patientId", async () => {
    const res = await resolvePatientAccess(SUPERADMIN, "user-patient-4");
    expect(res).toEqual({ patientUserId: "user-patient-4" });
  });
});

describe("therapistTreatsPatient()", () => {
  it("returns true when a shared appointment exists", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: "appt-1" } as never);
    expect(await therapistTreatsPatient("t1", "p1")).toBe(true);
  });

  it("returns false when no shared appointment exists", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null as never);
    expect(await therapistTreatsPatient("t1", "p2")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. GET /api/mood — MoodCheckin.patientId is a User id
// ---------------------------------------------------------------------------

describe("GET /api/mood", () => {
  it("blocks a therapist reading a non-client's mood data (403), no DB read", async () => {
    const { GET } = await import("@/app/api/mood/route");
    signIn(THERAPIST);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null as never); // no relationship

    const res = (await GET(makeRequest("user-patient-2"))) as unknown as {
      status: number;
    };

    expect(res.status).toBe(403);
    expect(prisma.moodCheckin.findMany).not.toHaveBeenCalled();
  });

  it("rejects a therapist with no patientId (400) — no unscoped all-patients query", async () => {
    const { GET } = await import("@/app/api/mood/route");
    signIn(THERAPIST);

    const res = (await GET(makeRequest())) as unknown as { status: number };

    expect(res.status).toBe(400);
    expect(prisma.moodCheckin.findMany).not.toHaveBeenCalled();
  });

  it("scopes a patient to their own id regardless of requested id", async () => {
    const { GET } = await import("@/app/api/mood/route");
    signIn(PATIENT);

    await GET(makeRequest("user-patient-999"));

    expect(prisma.moodCheckin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: PATIENT.id } })
    );
  });

  it("scopes a therapist WITH a relationship to the requested patient", async () => {
    const { GET } = await import("@/app/api/mood/route");
    signIn(THERAPIST);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: "appt-1" } as never);

    await GET(makeRequest("user-patient-1"));

    expect(prisma.moodCheckin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: "user-patient-1" } })
    );
  });
});

// ---------------------------------------------------------------------------
// 3. GET /api/assessments — patientId param resolves to a PatientProfile id
// ---------------------------------------------------------------------------

describe("GET /api/assessments", () => {
  it("blocks a therapist reading a non-client's assessments (403)", async () => {
    const { GET } = await import("@/app/api/assessments/route");
    signIn(THERAPIST);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null as never);

    const res = (await GET(makeRequest("user-patient-2"))) as unknown as {
      status: number;
    };

    expect(res.status).toBe(403);
    expect(prisma.assessment.findMany).not.toHaveBeenCalled();
  });

  it("rejects a coordinator with no patientId (400)", async () => {
    const { GET } = await import("@/app/api/assessments/route");
    signIn(COORDINATOR);

    const res = (await GET(makeRequest())) as unknown as { status: number };

    expect(res.status).toBe(400);
    expect(prisma.assessment.findMany).not.toHaveBeenCalled();
  });

  it("scopes a patient to their own profile", async () => {
    const { GET } = await import("@/app/api/assessments/route");
    signIn(PATIENT);
    vi.mocked(prisma.patientProfile.findUnique).mockResolvedValue({
      id: "profile-patient-1",
    } as never);

    await GET(makeRequest());

    // Profile is looked up by the patient's OWN user id, never a supplied one.
    expect(prisma.patientProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: PATIENT.id } })
    );
    expect(prisma.assessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: "profile-patient-1" } })
    );
  });

  it("scopes a therapist WITH a relationship to the requested patient's profile", async () => {
    const { GET } = await import("@/app/api/assessments/route");
    signIn(THERAPIST);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: "appt-1" } as never);
    vi.mocked(prisma.patientProfile.findUnique).mockResolvedValue({
      id: "profile-patient-1",
    } as never);

    await GET(makeRequest("user-patient-1"));

    expect(prisma.patientProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-patient-1" } })
    );
    expect(prisma.assessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: "profile-patient-1" } })
    );
  });
});
