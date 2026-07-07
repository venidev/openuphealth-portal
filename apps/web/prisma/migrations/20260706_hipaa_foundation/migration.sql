-- HIPAA Phase 1 foundation: AuditLog v2 + Consent/Disclosure/Referral models.
-- All changes are additive (new columns/tables); no data loss.

-- AuditLog v2 (T8)
ALTER TABLE "AuditLog" ADD COLUMN "userRole" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "patientId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "purpose" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "success" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "AuditLog_patientId_createdAt_idx" ON "AuditLog"("patientId", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- Consent (Privacy Rule)
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "channel" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Consent_userId_type_idx" ON "Consent"("userId", "type");
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DisclosureRecord (accounting of disclosures)
CREATE TABLE "DisclosureRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "disclosedTo" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "disclosedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisclosureRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DisclosureRecord_patientId_disclosedAt_idx" ON "DisclosureRecord"("patientId", "disclosedAt");

-- Referral (R1-R3)
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "tenantId" TEXT,
    "patientId" TEXT,
    "patientFirstName" TEXT,
    "patientLastName" TEXT,
    "patientDob" TIMESTAMP(3),
    "patientPhone" TEXT,
    "patientEmail" TEXT,
    "referringProvider" TEXT,
    "referringNpi" TEXT,
    "referringOrg" TEXT,
    "externalProviderId" TEXT,
    "reason" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'routine',
    "idempotencyKey" TEXT,
    "consentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Referral_tenantId_idempotencyKey_key" ON "Referral"("tenantId", "idempotencyKey");
CREATE INDEX "Referral_status_urgency_idx" ON "Referral"("status", "urgency");

-- ExternalProvider (R3 refer-out directory)
CREATE TABLE "ExternalProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "npi" TEXT,
    "specialty" TEXT,
    "statesServed" TEXT,
    "insuranceAccepted" TEXT,
    "contact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalProvider_pkey" PRIMARY KEY ("id")
);

-- TherapistLicense (licensure enforcement)
CREATE TABLE "TherapistLicense" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseType" TEXT,
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TherapistLicense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TherapistLicense_therapistId_state_idx" ON "TherapistLicense"("therapistId", "state");
ALTER TABLE "TherapistLicense" ADD CONSTRAINT "TherapistLicense_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "TherapistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
