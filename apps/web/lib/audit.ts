import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

export type AuditPurpose =
  | "treatment"
  | "payment"
  | "operations"
  | "patient-request"
  | "security";

// HIPAA audit control (PRODUCT_SCOPE T8). Records who did what to whose PHI,
// why, and whether it succeeded. metadata MUST be PHI-free.
export async function logAudit(params: {
  userId?: string;
  userRole?: string;
  patientId?: string; // subject of the access, not the actor
  action: string;
  resourceType?: string;
  resourceId?: string;
  purpose?: AuditPurpose;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        userRole: params.userRole,
        patientId: params.patientId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        purpose: params.purpose,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        success: params.success ?? true,
      },
    });
  } catch (error) {
    // Never let audit failure surface PHI or break the request path.
    console.error("Failed to create audit log:", error);
  }
}

// Extract request context for audit records without capturing PHI.
export function auditContext(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}
