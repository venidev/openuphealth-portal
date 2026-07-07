/**
 * OpenUpHealth – Patient Rights Tests (PRODUCT_SCOPE Privacy Rule)
 *
 * Consent capture (versioned, append-only), record export (Right of Access,
 * self-scoped), and accounting of disclosures (self-scoped).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    consent: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    disclosureRecord: { findMany: vi.fn() },
    patientProfile: { findUnique: vi.fn() },
    appointment: { findMany: vi.fn() },
    assessment: { findMany: vi.fn() },
    moodCheckin: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    intakeForm: { findMany: vi.fn() },
    insuranceInfo: { findMany: vi.fn() },
    messageThread: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NPP_VERSION } from "@/lib/consent";
import type { AuthenticatedUser } from "@/lib/rbac";

const PATIENT: AuthenticatedUser = { id: "u-pat", email: "p@t", name: "P", role: "patient" };
const THERAPIST: AuthenticatedUser = { id: "u-thr", email: "t@t", name: "T", role: "therapist" };

function signIn(user: AuthenticatedUser | null) {
  vi.mocked(auth).mockResolvedValue(user ? ({ user } as never) : (null as never));
}
function req(body?: unknown) {
  return { url: "http://localhost/api/x", headers: new Headers(), json: async () => body } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of [
    prisma.consent.findMany, prisma.disclosureRecord.findMany, prisma.appointment.findMany,
    prisma.assessment.findMany, prisma.moodCheckin.findMany, prisma.invoice.findMany,
    prisma.intakeForm.findMany, prisma.insuranceInfo.findMany, prisma.messageThread.findMany,
  ]) vi.mocked(m).mockResolvedValue([] as never);
  vi.mocked(prisma.patientProfile.findUnique).mockResolvedValue({ id: "prof-1" } as never);
  vi.mocked(prisma.consent.create).mockImplementation(
    (async (a: { data: Record<string, unknown> }) => ({ id: "c1", ...a.data })) as never
  );
});

describe("GET /api/consents", () => {
  it("requires authentication", async () => {
    const { GET } = await import("@/app/api/consents/route");
    signIn(null);
    const res = (await GET()) as unknown as { status: number };
    expect(res.status).toBe(401);
  });

  it("returns the caller's consents, active set, and current NPP version", async () => {
    const { GET } = await import("@/app/api/consents/route");
    signIn(PATIENT);
    vi.mocked(prisma.consent.findMany).mockResolvedValue([
      { type: "telehealth", revokedAt: null },
      { type: "communications", revokedAt: new Date() },
    ] as never);
    const res = (await GET()) as unknown as { body: { active: string[]; currentNppVersion: string } };
    expect(res.body.active).toContain("telehealth");
    expect(res.body.active).not.toContain("communications");
    expect(res.body.currentNppVersion).toBe(NPP_VERSION);
  });
});

describe("POST /api/consents", () => {
  it("stamps the NPP version when acknowledging the notice", async () => {
    const { POST } = await import("@/app/api/consents/route");
    signIn(PATIENT);
    const res = (await POST(req({ type: "notice-of-privacy-practices" }))) as unknown as {
      status: number;
      body: { data: { documentVersion: string } };
    };
    expect(res.status).toBe(201);
    expect(res.body.data.documentVersion).toBe(NPP_VERSION);
  });

  it("rejects an invalid consent type", async () => {
    const { POST } = await import("@/app/api/consents/route");
    signIn(PATIENT);
    const res = (await POST(req({ type: "nonsense" }))) as unknown as { status: number };
    expect(res.status).toBe(400);
    expect(prisma.consent.create).not.toHaveBeenCalled();
  });

  it("revokes by stamping revokedAt, never deleting", async () => {
    const { POST } = await import("@/app/api/consents/route");
    signIn(PATIENT);
    await POST(req({ type: "telehealth", revoke: true }));
    expect(prisma.consent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) })
    );
    expect(prisma.consent.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/patient/export", () => {
  it("is patient-only (therapist forbidden)", async () => {
    const { GET } = await import("@/app/api/patient/export/route");
    signIn(THERAPIST);
    const res = (await GET(req())) as unknown as { status: number };
    expect(res.status).toBe(403);
  });

  it("gathers only the caller's own record and audits the access", async () => {
    const { GET } = await import("@/app/api/patient/export/route");
    signIn(PATIENT);
    await GET(req());
    // Self-scoped: user-keyed models filter on the caller's user id.
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: PATIENT.id } })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "record.exported" }) })
    );
  });
});

describe("GET /api/patient/disclosures", () => {
  it("is patient-only and self-scoped", async () => {
    const { GET } = await import("@/app/api/patient/disclosures/route");
    signIn(PATIENT);
    await GET();
    expect(prisma.disclosureRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: PATIENT.id } })
    );
  });
});
