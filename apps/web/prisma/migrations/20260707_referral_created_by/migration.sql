-- Referral feature: track initiator and add lookup indexes. Additive.
ALTER TABLE "Referral" ADD COLUMN "createdById" TEXT;
CREATE UNIQUE INDEX "Referral_idempotencyKey_key" ON "Referral"("idempotencyKey");
CREATE INDEX "Referral_createdById_idx" ON "Referral"("createdById");
CREATE INDEX "Referral_patientId_idx" ON "Referral"("patientId");
