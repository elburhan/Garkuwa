ALTER TYPE "LiveEventStatus" ADD VALUE IF NOT EXISTS 'DRAFT' BEFORE 'ACTIVE';

ALTER TABLE "live_events" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "live_events" ALTER COLUMN "started_at" DROP NOT NULL;
ALTER TABLE "live_events" ALTER COLUMN "started_at" DROP DEFAULT;

CREATE TYPE "LiveEventOperationType" AS ENUM ('CREATED', 'STARTED', 'ENDED', 'REOPENED', 'ARCHIVED');

ALTER TABLE "live_events" ADD COLUMN "next_sequence" INTEGER NOT NULL DEFAULT 0;
UPDATE "live_events" event
SET "next_sequence" = COALESCE((
  SELECT MAX(update."sequence") FROM "live_updates" update WHERE update."live_event_id" = event."id"
), 0);

ALTER TABLE "live_updates"
  ADD COLUMN "is_pinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "corrected_at" TIMESTAMPTZ(3),
  ADD COLUMN "withdrawn_at" TIMESTAMPTZ(3),
  ADD COLUMN "withdrawn_by_id" UUID,
  ADD COLUMN "withdrawal_reason" VARCHAR(1000),
  ADD COLUMN "media_id" UUID,
  ADD COLUMN "client_submission_id" UUID;

UPDATE "live_updates" SET "client_submission_id" = "id" WHERE "client_submission_id" IS NULL;
ALTER TABLE "live_updates" ALTER COLUMN "client_submission_id" SET NOT NULL;

CREATE TABLE "live_update_revisions" (
  "id" UUID NOT NULL,
  "live_update_id" UUID NOT NULL,
  "headline_ha" VARCHAR(180),
  "headline_en" VARCHAR(180),
  "body_ha" TEXT NOT NULL,
  "body_en" TEXT,
  "reason" VARCHAR(1000) NOT NULL,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_update_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "live_event_operations" (
  "id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "action" "LiveEventOperationType" NOT NULL,
  "actor_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_event_operations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "live_updates_live_event_id_client_submission_id_key"
  ON "live_updates"("live_event_id", "client_submission_id");
CREATE INDEX "live_updates_media_id_idx" ON "live_updates"("media_id");
CREATE INDEX "live_update_revisions_live_update_id_created_at_idx"
  ON "live_update_revisions"("live_update_id", "created_at");
CREATE INDEX "live_event_operations_event_id_created_at_idx"
  ON "live_event_operations"("event_id", "created_at");

ALTER TABLE "live_updates" ADD CONSTRAINT "live_updates_withdrawn_by_id_fkey"
  FOREIGN KEY ("withdrawn_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "live_updates" ADD CONSTRAINT "live_updates_media_id_fkey"
  FOREIGN KEY ("media_id") REFERENCES "newsroom_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "live_update_revisions" ADD CONSTRAINT "live_update_revisions_live_update_id_fkey"
  FOREIGN KEY ("live_update_id") REFERENCES "live_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_update_revisions" ADD CONSTRAINT "live_update_revisions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "live_event_operations" ADD CONSTRAINT "live_event_operations_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "live_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_event_operations" ADD CONSTRAINT "live_event_operations_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
