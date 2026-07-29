-- CreateTable
CREATE TABLE "news_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name_ha" VARCHAR(160) NOT NULL,
    "name_en" VARCHAR(160) NOT NULL,
    "description_ha" VARCHAR(500),
    "description_en" VARCHAR(500),
    "display_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "news_categories_pkey" PRIMARY KEY ("id")
);

-- Seed the reviewed, controlled taxonomy with stable identifiers.
INSERT INTO "news_categories"
    ("id", "code", "slug", "name_ha", "name_en", "description_ha", "description_en", "display_order", "is_active", "created_at", "updated_at")
VALUES
    ('10000000-0000-4000-8000-000000000001', 'ANNOUNCEMENTS', 'announcements', 'Sanarwa', 'Announcements', 'Sanarwar hukuma, haɗin gwiwa, manufofi da saƙonnin shugabanci.', 'Official statements, partnerships, policies and leadership messages.', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000002', 'SECURITY_ADVISORIES', 'security-advisories', 'Shawarwari na Tsaro', 'Security Advisories', 'Bayanan haɗarin tsaro, matakan rage haɗari da shawarwarin kariya.', 'Security risks, incidents, mitigations and recommended actions.', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000003', 'COMMUNITY_UPDATES', 'community-updates', 'Sabuntawar Al’umma', 'Community Updates', 'Sabbin bayanai kan al’umma, masu ba da gudummawa da ci gaban ayyuka.', 'Community, contributor and project developments.', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000004', 'FOUNDATION_ACTIVITIES', 'foundation-activities', 'Ayyukan Garkuwa', 'Foundation Activities', 'Taron karawa juna sani, rahotanni da muhimman matakan ayyukan Garkuwa.', 'Events, workshops, reports and operational milestones.', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000005', 'LIVE_UPDATES', 'live-updates', 'Sabuntawa na Kai Tsaye', 'Live Updates', 'Gajerun bayanai na gaskiya da ke da muhimmancin lokaci.', 'Short factual and time-sensitive bulletins.', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000006', 'NEWS', 'news', 'Labarai', 'News', 'Babban rukunin labaran Garkuwa da bayanan da ba su dace da takamaiman rukuni ba.', 'Compatibility category and broader institutional reporting.', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add the relation without disrupting existing articles, then backfill conservatively.
ALTER TABLE "news_articles" ADD COLUMN "category_id" UUID;
UPDATE "news_articles"
SET "category_id" = (
    SELECT "id" FROM "news_categories" WHERE "code" = 'NEWS'
)
WHERE "category_id" IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "news_articles" WHERE "category_id" IS NULL) THEN
        RAISE EXCEPTION 'News category backfill left uncategorized articles';
    END IF;
END $$;

ALTER TABLE "news_articles" ALTER COLUMN "category_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "news_categories_code_key" ON "news_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "news_categories_slug_key" ON "news_categories"("slug");

-- CreateIndex
CREATE INDEX "news_categories_is_active_display_order_idx" ON "news_categories"("is_active", "display_order");

-- CreateIndex
CREATE INDEX "news_articles_category_id_idx" ON "news_articles"("category_id");

-- CreateIndex
CREATE INDEX "news_articles_status_category_id_published_at_idx" ON "news_articles"("status", "category_id", "published_at");

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "news_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
