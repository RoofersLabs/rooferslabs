-- Twilio call recording metadata (started automatically for answered calls)
ALTER TABLE "calls" ADD COLUMN "recordingSid" TEXT,
                    ADD COLUMN "recordingStatus" TEXT,
                    ADD COLUMN "recordingDuration" INTEGER;

CREATE UNIQUE INDEX "calls_recordingSid_key" ON "calls"("recordingSid");
