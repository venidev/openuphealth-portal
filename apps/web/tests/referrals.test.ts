/**
 * OpenUpHealth – Referral Workflow Tests (PRODUCT_SCOPE R1–R3)
 *
 * Covers lifecycle transitions, role-based creation authorization, patient
 * self-scoping, therapist treatment-relationship enforcement, idempotency,
 * and status-change validation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    appointment: { findFirst: vi.fn() },
    referral: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isValidTransition, isTerminal } from "@/lib/referrals";
import type { AuthenticatedUser } from "@/lib/rbac";

const PATIENT: AuthenticatedUser = { id: "u-pat", email: "p@t", name: "P", role: "patient" };
const THERAPIST: AuthenticatedUser = { id: "u-thr", email: "t@t", name: "T", role: "therapist" };
const COORD: AuthenticatedUser = { id: "u-coo", email: "c@t", name: "C", role: "care_coordinator" };

function signIn(user: AuthenticatedUser | null) {
  vi.mocked(auth).mockResolvedValue(user ? ({ user } as never) : (null as never));
}
function post(body: unknown) {
  return {
    url: "http://localhost/api/referrals",
    headers: new Headers(),
    json: async () => body,
  } as never;
}
function patchReq(body: unknown) {
  return {
    url: "http://localhost/api/referrals/r1",
    headers: new Headers(),
    json: async () => body,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.referral.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.referral.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.referral.create).mockImplementation(
    (async (args: { data: Record<string, unknown> }) => ({ id: "r-new", ...args.data })) as never
  );
  vi.mocked(prisma.referral.update).mockImplementation(
    (async (args: { data: Record<string, unknown> }) => ({ id: "r1", ...args.data })) as never
  );
});

// ---------------------------------------------------------------------------
// 1. Lifecycle — lib/referrals.ts
// ---------------------------------------------------------------------------

describe("referral lifecycle", () => {
  it("permits valid forward transitions", () => {
    expect(isValidTransition("received", "triaged")).toBe(true);
    expect(isValidTransition("triaged", "patient_contacted")).toBe(true);
    expect(isValidTransition("converted", "scheduled")).toBe(true);
  });

  it("rejects invalid or backward transitions", () => {
    expect(isValidTransition("received", "scheduled")).toBe(false);
    expect(isValidTransition("scheduled", "received")).toBe(false);
    expect(isValidTransition("completed", "triaged")).toBe(false);
  });

  it("marks terminal states", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("declined")).toBe(true);
    expect(isTerminal("received")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. POST /api/referrals — creation authorization
// ---------------------------------------------------------------------------

describe("POST /api/referrals", () => {
  it("lets a patient request a rematch, forcing patientId to self", async () => {
    const { POST } = await import("@/app/api/referrals/route");
    signIn(PATIENT);
    const res = (await POST(
      post({ type: "internal_transfer", patientId: "someone-else", reason: "fit" })
    )) as unknown as { status: number; body: { data: { patientId: string } } };

    expect(res.status).toBe(201);
    expect(res.body.data.patientId).toBe(PATIENT.id);
  });

  it("forbids a patient from creating an outbound referral", async () => {
    const { POST } = await import("@/app/api/referrals/route");
    signIn(PATIENT);
    const res = (await POST(post({ type: "outbound" }))) as unknown as { status: number };
    expect(res.status).toBe(403);
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it("forbids a therapist referring out a patient who is not theirs", async () => {
    const { POST } = await import("@/app/api/referrals/route");
    signIn(THERAPIST);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null as never);
    const res = (await POST(
      post({ type: "outbound", patientId: "u-other" })
    )) as unknown as { status: number };
    expect(res.status).toBe(403);
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it("lets a therapist refer out their own patient", async () => {
    const { POST } = await import("@/app/api/referrals/route");
    signIn(THERAPIST);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: "a1" } as never);
    const res = (await POST(
      post({ type: "outbound", patientId: "u-mine", reason: "needs psychiatry" })
    )) as unknown as { status: number };
    expect(res.status).toBe(201);
    expect(prisma.referral.create).toHaveBeenCalled();
  });

  it("rejects an invalid referral type", async () => {
    const { POST } = await import("@/app/api/referrals/route");
    signIn(COORD);
    const res = (await POST(post({ type: "nonsense" }))) as unknown as { status: number };
    expect(res.status).toBe(400);
  });

  it("is idempotent: a repeated idempotencyKey returns the original", async () => {
    const { POST } = await import("@/app/api/referrals/route");
    signIn(COORD);
    vi.mocked(prisma.referral.findFirst).mockResolvedValue({ id: "r-existing" } as never);
    const res = (await POST(
      post({ type: "inbound", idempotencyKey: "key-123" })
    )) as unknown as { status: number; body: { data: { id: string } } };
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("r-existing");
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. GET /api/referrals — role-scoped listing
// ---------------------------------------------------------------------------

describe("GET /api/referrals", () => {
  function getReq() {
    return { url: "http://localhost/api/referrals", headers: new Headers() } as never;
  }

  it("scopes a patient to their own referrals", async () => {
    const { GET } = await import("@/app/api/referrals/route");
    signIn(PATIENT);
    await GET(getReq());
    expect(prisma.referral.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ patientId: PATIENT.id }) })
    );
  });

  it("scopes a therapist to referrals they created", async () => {
    const { GET } = await import("@/app/api/referrals/route");
    signIn(THERAPIST);
    await GET(getReq());
    expect(prisma.referral.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdById: THERAPIST.id }) })
    );
  });

  it("gives a coordinator the unscoped queue", async () => {
    const { GET } = await import("@/app/api/referrals/route");
    signIn(COORD);
    await GET(getReq());
    const call = vi.mocked(prisma.referral.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where.patientId).toBeUndefined();
    expect(call.where.createdById).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. PATCH /api/referrals/[id] — status transitions
// ---------------------------------------------------------------------------

describe("PATCH /api/referrals/[id]", () => {
  const params = { params: Promise.resolve({ id: "r1" }) };

  it("blocks a therapist from triaging (coordinator-only)", async () => {
    const { PATCH } = await import("@/app/api/referrals/[id]/route");
    signIn(THERAPIST);
    const res = (await PATCH(patchReq({ status: "triaged" }), params)) as unknown as {
      status: number;
    };
    expect(res.status).toBe(403);
  });

  it("rejects an invalid transition with 409", async () => {
    const { PATCH } = await import("@/app/api/referrals/[id]/route");
    signIn(COORD);
    vi.mocked(prisma.referral.findUnique).mockResolvedValue({
      id: "r1",
      status: "received",
      patientId: "u-pat",
    } as never);
    const res = (await PATCH(patchReq({ status: "scheduled" }), params)) as unknown as {
      status: number;
    };
    expect(res.status).toBe(409);
    expect(prisma.referral.update).not.toHaveBeenCalled();
  });

  it("applies a valid transition", async () => {
    const { PATCH } = await import("@/app/api/referrals/[id]/route");
    signIn(COORD);
    vi.mocked(prisma.referral.findUnique).mockResolvedValue({
      id: "r1",
      status: "received",
      patientId: "u-pat",
    } as never);
    const res = (await PATCH(patchReq({ status: "triaged" }), params)) as unknown as {
      status: number;
    };
    expect(res.status).toBe(200);
    expect(prisma.referral.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "triaged" } })
    );
  });
});
