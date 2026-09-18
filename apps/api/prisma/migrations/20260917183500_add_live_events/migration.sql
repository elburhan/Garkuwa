-- CreateEnum
CREATE TYPE "LiveEventStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "live_events" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title_ha" VARCHAR(180) NOT NULL,
    "title_en" VARCHAR(180),
    "summary_ha" VARCHAR(500),
    "summary_en" VARCHAR(500),
    "status" "LiveEventStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "category_id" UUID NOT NULL,
    "featured_media_id" UUID,
    "created_by_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "live_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_updates" (
    "id" UUID NOT NULL,
    "live_event_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "headline_ha" VARCHAR(180),
    "headline_en" VARCHAR(180),
    "body_ha" TEXT NOT NULL,
    "body_en" TEXT,
    "is_retracted" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "live_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_events_slug_key" ON "live_events"("slug");

-- CreateIndex
CREATE INDEX "live_events_status_updated_at_idx" ON "live_events"("status", "updated_at");

-- CreateIndex
CREATE INDEX "live_events_category_id_status_idx" ON "live_events"("category_id", "status");

-- CreateIndex
CREATE INDEX "live_events_is_featured_status_idx" ON "live_events"("is_featured", "status");

-- CreateIndex
CREATE INDEX "live_updates_live_event_id_created_at_idx" ON "live_updates"("live_event_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "live_updates_live_event_id_sequence_key" ON "live_updates"("live_event_id", "sequence");

-- AddForeignKey
ALTER TABLE "live_events" ADD CONSTRAINT "live_events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "news_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_events" ADD CONSTRAINT "live_events_featured_media_id_fkey" FOREIGN KEY ("featured_media_id") REFERENCES "newsroom_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_events" ADD CONSTRAINT "live_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_updates" ADD CONSTRAINT "live_updates_live_event_id_fkey" FOREIGN KEY ("live_event_id") REFERENCES "live_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_updates" ADD CONSTRAINT "live_updates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
