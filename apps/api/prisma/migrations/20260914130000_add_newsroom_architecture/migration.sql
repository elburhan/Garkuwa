-- Extend the existing editorial lifecycle without replacing historical values.
ALTER TYPE "NewsArticleStatus" ADD VALUE 'CHANGES_REQUESTED';
ALTER TYPE "NewsArticleStatus" ADD VALUE 'READY_TO_PUBLISH';
ALTER TYPE "NewsArticleStatus" ADD VALUE 'UNPUBLISHED';

CREATE TYPE "NewsroomProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "EditorialLanguage" AS ENUM ('ha', 'en');
CREATE TYPE "NewsPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "NewsDesk" AS ENUM ('GENERAL', 'POLITICS', 'SECURITY', 'BUSINESS', 'EDUCATION', 'HEALTH', 'AGRICULTURE', 'TECHNOLOGY', 'SPORTS', 'CULTURE');
CREATE TYPE "ContributorPublicStatus" AS ENUM ('PRIVATE', 'PUBLIC');
CREATE TYPE "ArticleContributorRole" AS ENUM ('AUTHOR', 'REPORTER', 'EDITOR', 'PHOTO', 'VIDEO', 'TRANSLATOR');
CREATE TYPE "NewsSourceType" AS ENUM ('STAFF_REPORTER', 'CITIZEN_SOURCE', 'OFFICIAL_STATEMENT', 'PRESS_RELEASE', 'AGENCY', 'INTERVIEW', 'DOCUMENT', 'OTHER_PUBLICATION');

ALTER TABLE "news_articles"
  ADD COLUMN "draft_revision_id" UUID,
  ADD COLUMN "submitted_revision_id" UUID,
  ADD COLUMN "published_revision_id" UUID,
  ADD COLUMN "assigned_writer_id" UUID,
  ADD COLUMN "assigned_reviewer_id" UUID,
  ADD COLUMN "desk" "NewsDesk",
  ADD COLUMN "due_at" TIMESTAMPTZ(3),
  ADD COLUMN "priority" "NewsPriority" NOT NULL DEFAULT 'NORMAL';

CREATE TABLE "newsroom_staff_profiles" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "byline_name" VARCHAR(160) NOT NULL,
  "job_title" VARCHAR(160),
  "short_bio" VARCHAR(1000),
  "status" "NewsroomProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "preferred_editorial_language" "EditorialLanguage" NOT NULL DEFAULT 'ha',
  "public_author_visible" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "newsroom_staff_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_article_revisions" (
  "id" UUID NOT NULL,
  "article_id" UUID NOT NULL,
  "revision_number" INTEGER NOT NULL,
  "title_ha" VARCHAR(180) NOT NULL,
  "summary_ha" VARCHAR(500) NOT NULL,
  "body_ha" TEXT NOT NULL,
  "title_en" VARCHAR(180),
  "summary_en" VARCHAR(500),
  "body_en" TEXT,
  "created_by_id" UUID NOT NULL,
  "change_note" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_article_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_contributors" (
  "id" UUID NOT NULL,
  "display_name" VARCHAR(160) NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "bio" VARCHAR(1000),
  "user_id" UUID,
  "public_status" "ContributorPublicStatus" NOT NULL DEFAULT 'PRIVATE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "news_contributors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_article_contributors" (
  "article_id" UUID NOT NULL,
  "contributor_id" UUID NOT NULL,
  "role" "ArticleContributorRole" NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "news_article_contributors_pkey" PRIMARY KEY ("article_id", "contributor_id", "role")
);

CREATE TABLE "news_tags" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_article_tags" (
  "article_id" UUID NOT NULL,
  "tag_id" UUID NOT NULL,
  CONSTRAINT "news_article_tags_pkey" PRIMARY KEY ("article_id", "tag_id")
);

CREATE TABLE "news_topics" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "name_ha" VARCHAR(160) NOT NULL,
  "name_en" VARCHAR(160),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_article_topics" (
  "article_id" UUID NOT NULL,
  "topic_id" UUID NOT NULL,
  CONSTRAINT "news_article_topics_pkey" PRIMARY KEY ("article_id", "topic_id")
);

CREATE TABLE "news_article_locations" (
  "id" UUID NOT NULL,
  "article_id" UUID NOT NULL,
  "country" VARCHAR(100) NOT NULL DEFAULT 'Nigeria',
  "state" VARCHAR(100),
  "lga" VARCHAR(100),
  "place" VARCHAR(160),
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(10,6),
  CONSTRAINT "news_article_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_article_sources" (
  "id" UUID NOT NULL,
  "article_id" UUID NOT NULL,
  "type" "NewsSourceType" NOT NULL,
  "public_label" VARCHAR(300),
  "url" VARCHAR(2000),
  "organization" VARCHAR(200),
  "confidential" BOOLEAN NOT NULL DEFAULT false,
  "internal_notes" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_article_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_article_source_access_audits" (
  "id" UUID NOT NULL,
  "article_id" UUID NOT NULL,
  "source_id" UUID NOT NULL,
  "staff_id" UUID NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_article_source_access_audits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_article_assignment_history" (
  "id" UUID NOT NULL,
  "article_id" UUID NOT NULL,
  "from_writer_id" UUID,
  "to_writer_id" UUID,
  "from_reviewer_id" UUID,
  "to_reviewer_id" UUID,
  "from_desk" "NewsDesk",
  "to_desk" "NewsDesk",
  "from_due_at" TIMESTAMPTZ(3),
  "to_due_at" TIMESTAMPTZ(3),
  "from_priority" "NewsPriority" NOT NULL,
  "to_priority" "NewsPriority" NOT NULL,
  "changed_by_id" UUID NOT NULL,
  "reason" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_article_assignment_history_pkey" PRIMARY KEY ("id")
);

-- Give every legacy article an immutable revision before adding revision pointers.
INSERT INTO "news_article_revisions" (
  "id", "article_id", "revision_number", "title_ha", "summary_ha", "body_ha",
  "title_en", "summary_en", "body_en", "created_by_id", "change_note", "created_at"
)
SELECT gen_random_uuid(), "id", 1, "title_ha", "summary_ha", "body_ha",
  "title_en", "summary_en", "body_en", "author_id", 'Legacy article baseline', "updated_at"
FROM "news_articles";

UPDATE "news_articles" AS article
SET "draft_revision_id" = revision."id",
    "submitted_revision_id" = CASE WHEN article."status" <> 'DRAFT' THEN revision."id" ELSE NULL END,
    "published_revision_id" = CASE WHEN article."status" IN ('PUBLISHED', 'ARCHIVED') THEN revision."id" ELSE NULL END
FROM "news_article_revisions" AS revision
WHERE revision."article_id" = article."id" AND revision."revision_number" = 1;

INSERT INTO "news_article_status_history" (
  "id", "article_id", "from_status", "to_status", "actor_id", "reason", "created_at"
)
SELECT gen_random_uuid(), "id", NULL, "status", "author_id", 'Legacy article baseline', "updated_at"
FROM "news_articles";

INSERT INTO "news_contributors" ("id", "display_name", "slug", "user_id", "public_status", "updated_at")
SELECT gen_random_uuid(), user_record."display_name", 'staff-' || replace(user_record."id"::text, '-', ''), user_record."id", 'PUBLIC', CURRENT_TIMESTAMP
FROM "staff_users" AS user_record
WHERE EXISTS (SELECT 1 FROM "news_articles" WHERE "author_id" = user_record."id");

INSERT INTO "news_article_contributors" ("article_id", "contributor_id", "role", "display_order")
SELECT article."id", contributor."id", 'AUTHOR', 0
FROM "news_articles" AS article
JOIN "news_contributors" AS contributor ON contributor."user_id" = article."author_id";

CREATE UNIQUE INDEX "newsroom_staff_profiles_user_id_key" ON "newsroom_staff_profiles"("user_id");
CREATE INDEX "newsroom_staff_profiles_status_idx" ON "newsroom_staff_profiles"("status");
CREATE UNIQUE INDEX "news_article_revisions_article_id_revision_number_key" ON "news_article_revisions"("article_id", "revision_number");
CREATE INDEX "news_article_revisions_article_id_created_at_idx" ON "news_article_revisions"("article_id", "created_at");
CREATE INDEX "news_article_revisions_created_by_id_created_at_idx" ON "news_article_revisions"("created_by_id", "created_at");
CREATE UNIQUE INDEX "news_contributors_slug_key" ON "news_contributors"("slug");
CREATE UNIQUE INDEX "news_contributors_user_id_key" ON "news_contributors"("user_id");
CREATE INDEX "news_contributors_public_status_display_name_idx" ON "news_contributors"("public_status", "display_name");
CREATE INDEX "news_article_contributors_article_id_display_order_idx" ON "news_article_contributors"("article_id", "display_order");
CREATE UNIQUE INDEX "news_tags_slug_key" ON "news_tags"("slug");
CREATE INDEX "news_article_tags_tag_id_idx" ON "news_article_tags"("tag_id");
CREATE UNIQUE INDEX "news_topics_slug_key" ON "news_topics"("slug");
CREATE INDEX "news_article_topics_topic_id_idx" ON "news_article_topics"("topic_id");
CREATE INDEX "news_article_locations_article_id_idx" ON "news_article_locations"("article_id");
CREATE INDEX "news_article_locations_country_state_lga_idx" ON "news_article_locations"("country", "state", "lga");
CREATE INDEX "news_article_sources_article_id_type_idx" ON "news_article_sources"("article_id", "type");
CREATE INDEX "news_article_assignment_history_article_id_created_at_idx" ON "news_article_assignment_history"("article_id", "created_at");
CREATE INDEX "news_article_assignment_history_changed_by_id_created_at_idx" ON "news_article_assignment_history"("changed_by_id", "created_at");
CREATE UNIQUE INDEX "news_articles_draft_revision_id_key" ON "news_articles"("draft_revision_id");
CREATE UNIQUE INDEX "news_articles_submitted_revision_id_key" ON "news_articles"("submitted_revision_id");
CREATE UNIQUE INDEX "news_articles_published_revision_id_key" ON "news_articles"("published_revision_id");
CREATE INDEX "news_articles_assigned_writer_id_status_updated_at_idx" ON "news_articles"("assigned_writer_id", "status", "updated_at");
CREATE INDEX "news_articles_assigned_reviewer_id_status_updated_at_idx" ON "news_articles"("assigned_reviewer_id", "status", "updated_at");
CREATE INDEX "news_articles_desk_status_updated_at_idx" ON "news_articles"("desk", "status", "updated_at");
CREATE INDEX "news_articles_priority_status_updated_at_idx" ON "news_articles"("priority", "status", "updated_at");

ALTER TABLE "newsroom_staff_profiles" ADD CONSTRAINT "newsroom_staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_revisions" ADD CONSTRAINT "news_article_revisions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_revisions" ADD CONSTRAINT "news_article_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "news_contributors" ADD CONSTRAINT "news_contributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "news_article_contributors" ADD CONSTRAINT "news_article_contributors_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_contributors" ADD CONSTRAINT "news_article_contributors_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "news_contributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "news_article_tags" ADD CONSTRAINT "news_article_tags_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_tags" ADD CONSTRAINT "news_article_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "news_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "news_article_topics" ADD CONSTRAINT "news_article_topics_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_topics" ADD CONSTRAINT "news_article_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "news_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "news_article_locations" ADD CONSTRAINT "news_article_locations_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_sources" ADD CONSTRAINT "news_article_sources_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_source_access_audits" ADD CONSTRAINT "news_article_source_access_audits_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_source_access_audits" ADD CONSTRAINT "news_article_source_access_audits_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "news_article_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_source_access_audits" ADD CONSTRAINT "news_article_source_access_audits_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "news_article_assignment_history" ADD CONSTRAINT "news_article_assignment_history_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_article_assignment_history" ADD CONSTRAINT "news_article_assignment_history_from_writer_id_fkey" FOREIGN KEY ("from_writer_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "news_article_assignment_history" ADD CONSTRAINT "news_article_assignment_history_to_writer_id_fkey" FOREIGN KEY ("to_writer_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "news_article_assignment_history" ADD CONSTRAINT "news_article_assignment_history_from_reviewer_id_fkey" FOREIGN KEY ("from_reviewer_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "news_article_assignment_history" ADD CONSTRAINT "news_article_assignment_history_to_reviewer_id_fkey" FOREIGN KEY ("to_reviewer_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "news_article_assignment_history" ADD CONSTRAINT "news_article_assignment_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_draft_revision_id_fkey" FOREIGN KEY ("draft_revision_id") REFERENCES "news_article_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_submitted_revision_id_fkey" FOREIGN KEY ("submitted_revision_id") REFERENCES "news_article_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_published_revision_id_fkey" FOREIGN KEY ("published_revision_id") REFERENCES "news_article_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_assigned_writer_id_fkey" FOREIGN KEY ("assigned_writer_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_assigned_reviewer_id_fkey" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "news_article_source_access_audits_article_id_created_at_idx" ON "news_article_source_access_audits"("article_id", "created_at");
CREATE INDEX "news_article_source_access_audits_source_id_created_at_idx" ON "news_article_source_access_audits"("source_id", "created_at");
CREATE INDEX "news_article_source_access_audits_staff_id_created_at_idx" ON "news_article_source_access_audits"("staff_id", "created_at");

CREATE OR REPLACE FUNCTION validate_news_article_revision_pointer_ownership()
RETURNS trigger AS $$
BEGIN
  IF NEW.draft_revision_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM news_article_revisions WHERE id = NEW.draft_revision_id AND article_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'draft revision belongs to another article';
  END IF;
  IF NEW.submitted_revision_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM news_article_revisions WHERE id = NEW.submitted_revision_id AND article_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'submitted revision belongs to another article';
  END IF;
  IF NEW.published_revision_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM news_article_revisions WHERE id = NEW.published_revision_id AND article_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'published revision belongs to another article';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER news_article_revision_pointer_ownership_trigger
BEFORE INSERT OR UPDATE OF draft_revision_id, submitted_revision_id, published_revision_id
ON news_articles
FOR EACH ROW EXECUTE FUNCTION validate_news_article_revision_pointer_ownership();
