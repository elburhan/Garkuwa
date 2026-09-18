ALTER TABLE "news_tags" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "news_topics" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "news_article_sources" ADD COLUMN "display_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "news_tags_is_active_name_idx" ON "news_tags"("is_active", "name");
CREATE INDEX "news_topics_is_active_name_ha_idx" ON "news_topics"("is_active", "name_ha");
CREATE INDEX "news_article_sources_article_id_display_order_idx" ON "news_article_sources"("article_id", "display_order");