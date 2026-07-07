/**
 * OpenUpHealth – External Provider Directory Tests (R3 refer-out directory)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    externalProvider: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { AuthenticatedUser } from "@/lib/rbac";

const THERAPIST: AuthenticatedUser = { id: "u-thr", email: "t@t", name: "T", role: "therapist" };
const COORD: AuthenticatedUser = { id: "u-coo", email: "c@t", name: "C", role: "care_coordinator" };

function signIn(user: AuthenticatedUser | null) {
  vi.mocked(auth).mockResolvedValue(user ? ({ user } as never) : (null as never));
}
function req(body?: unknown) {
  return {
    url: "http://localhost/api/external-providers",
    headers: new Headers(),
    json: async () => body,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.externalProvider.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.externalProvider.create).mockImplementation(
    (async (a: { data: Record<string, unknown> }) => ({ id: "ep-1", ...a.data })) as never
  );
});

describe("GET /api/external-providers", () => {
  it("is available to therapists (for refer-out)", async () => {
    const { GET } = await import("@/app/api/external-providers/route");
    signIn(THERAPIST);
    const res = (await GET(req())) as unknown as { status: number };
    expect(res.status).toBe(200);
  });
});

describe("POST /api/external-providers", () => {
  it("forbids a therapist from adding directory entries (coordinator-only)", async () => {
    const { POST } = await import("@/app/api/external-providers/route");
    signIn(THERAPIST);
    const res = (await POST(req({ name: "X" }))) as unknown as { status: number };
    expect(res.status).toBe(403);
    expect(prisma.externalProvider.create).not.toHaveBeenCalled();
  });

  it("requires a name", async () => {
    const { POST } = await import("@/app/api/external-providers/route");
    signIn(COORD);
    const res = (await POST(req({}))) as unknown as { status: number };
    expect(res.status).toBe(400);
  });

  it("lets a coordinator add a provider, serializing array fields", async () => {
    const { POST } = await import("@/app/api/external-providers/route");
    signIn(COORD);
    const res = (await POST(
      req({ name: "Bay Psychiatry", statesServed: ["CA", "NV"] })
    )) as unknown as { status: number };
    expect(res.status).toBe(201);
    expect(prisma.externalProvider.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statesServed: JSON.stringify(["CA", "NV"]) }),
      })
    );
  });
});
