CREATE TYPE "NewsroomMediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');
CREATE TYPE "NewsroomMediaStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "NewsroomMediaProvenance" AS ENUM ('STAFF', 'AGENCY', 'OFFICIAL', 'CITIZEN_APPROVED', 'EXTERNAL', 'OTHER');
CREATE TYPE "NewsArticleMediaRole" AS ENUM ('INLINE', 'GALLERY');

ALTER TABLE "news_article_revisions"
  ADD COLUMN "body_blocks_ha" JSONB,
  ADD COLUMN "body_blocks_en" JSONB;

ALTER TABLE "news_articles"
  ADD COLUMN "featured_media_id" UUID,
  ADD COLUMN "social_media_id" UUID,
  ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "is_breaking" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "public_updated_at" TIMESTAMPTZ(3);

UPDATE "news_articles"
SET "public_updated_at" = "published_at"
WHERE "published_at" IS NOT NULL;

CREATE TABLE "newsroom_media" (
  "id" UUID NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "original_filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "sha256" CHAR(64) NOT NULL,
  "media_type" "NewsroomMediaType" NOT NULL DEFAULT 'IMAGE',
  "status" "NewsroomMediaStatus" NOT NULL DEFAULT 'ACTIVE',
  "provenance" "NewsroomMediaProvenance" NOT NULL,
  "alt_text_ha" VARCHAR(500) NOT NULL,
  "alt_text_en" VARCHAR(500),
  "caption_ha" VARCHAR(1000),
  "caption_en" VARCHAR(1000),
  "credit" VARCHAR(300),
  "source" VARCHAR(500),
  "rights_notes" VARCHAR(2000),
  "uploaded_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "newsroom_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_article_media" (
  "article_id" UUID NOT NULL,
  "media_id" UUID NOT NULL,
  "role" "NewsArticleMediaRole" NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "news_article_media_pkey" PRIMARY KEY ("article_id", "media_id", "role")
);

CREATE TABLE "news_article_corrections" (
  "id" UUID NOT NULL,
  "article_id" UUID NOT NULL,
  "note_ha" VARCHAR(2000) NOT NULL,
  "note_en" VARCHAR(2000),
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_article_corrections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "newsroom_media_storage_key_key" ON "newsroom_media"("storage_key");
CREATE INDEX "newsroom_media_status_created_at_idx" ON "newsroom_media"("status", "created_at");
CREATE INDEX "newsroom_media_sha256_idx" ON "newsroom_media"("sha256");
CREATE INDEX "newsroom_media_uploaded_by_id_created_at_idx" ON "newsroom_media"("uploaded_by_id", "created_at");
CREATE INDEX "newsroom_media_provenance_status_idx" ON "newsroom_media"("provenance", "status");
CREATE INDEX "news_article_media_article_id_role_display_order_idx" ON "news_article_media"("article_id", "role", "display_order");
CREATE INDEX "news_article_media_media_id_idx" ON "news_article_media"("media_id");
CREATE INDEX "news_article_corrections_article_id_created_at_idx" ON "news_article_corrections"("article_id", "created_at");
CREATE INDEX "news_article_corrections_created_by_id_created_at_idx" ON "news_article_corrections"("created_by_id", "created_at");
CREATE INDEX "news_articles_is_featured_status_published_at_idx" ON "news_articles"("is_featured", "status", "published_at");
CREATE INDEX "news_articles_is_breaking_status_published_at_idx" ON "news_articles"("is_breaking", "status", "published_at");

ALTER TABLE "newsroom_media" ADD CONSTRAINT "newsroom_media_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "news_article_media" ADD CONSTRAINT "news_article_media_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_media" ADD CONSTRAINT "news_article_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "newsroom_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "news_article_corrections" ADD CONSTRAINT "news_article_corrections_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_corrections" ADD CONSTRAINT "news_article_corrections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_featured_media_id_fkey" FOREIGN KEY ("featured_media_id") REFERENCES "newsroom_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_social_media_id_fkey" FOREIGN KEY ("social_media_id") REFERENCES "newsroom_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
