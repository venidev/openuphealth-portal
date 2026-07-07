-- Follow-up appointments: link to originating appointment. Additive.
ALTER TABLE "Appointment" ADD COLUMN "followUpOfId" TEXT;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_followUpOfId_fkey" FOREIGN KEY ("followUpOfId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Appointment_therapistId_startsAt_idx" ON "Appointment"("therapistId", "startsAt");
