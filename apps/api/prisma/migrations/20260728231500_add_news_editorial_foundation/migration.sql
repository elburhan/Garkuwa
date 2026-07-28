-- CreateEnum
CREATE TYPE "NewsArticleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "news_articles" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "status" "NewsArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "author_id" UUID NOT NULL,
    "title_ha" VARCHAR(180) NOT NULL,
    "summary_ha" VARCHAR(500) NOT NULL,
    "body_ha" TEXT NOT NULL,
    "title_en" VARCHAR(180),
    "summary_en" VARCHAR(500),
    "body_en" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "submitted_for_review_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_article_status_history" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "from_status" "NewsArticleStatus",
    "to_status" "NewsArticleStatus" NOT NULL,
    "actor_id" UUID NOT NULL,
    "reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_article_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_slug_key" ON "news_articles"("slug");

-- CreateIndex
CREATE INDEX "news_articles_status_updated_at_idx" ON "news_articles"("status", "updated_at");

-- CreateIndex
CREATE INDEX "news_articles_author_id_updated_at_idx" ON "news_articles"("author_id", "updated_at");

-- CreateIndex
CREATE INDEX "news_articles_created_at_idx" ON "news_articles"("created_at");

-- CreateIndex
CREATE INDEX "news_articles_published_at_idx" ON "news_articles"("published_at");

-- CreateIndex
CREATE INDEX "news_article_status_history_article_id_created_at_idx" ON "news_article_status_history"("article_id", "created_at");

-- CreateIndex
CREATE INDEX "news_article_status_history_actor_id_created_at_idx" ON "news_article_status_history"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_status_history" ADD CONSTRAINT "news_article_status_history_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_status_history" ADD CONSTRAINT "news_article_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
