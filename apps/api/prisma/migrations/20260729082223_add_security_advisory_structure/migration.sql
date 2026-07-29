-- CreateEnum
CREATE TYPE "SecurityAdvisorySeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL');

-- CreateTable
CREATE TABLE "news_security_advisories" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "severity" "SecurityAdvisorySeverity" NOT NULL,
    "affected_area_ha" TEXT NOT NULL,
    "affected_area_en" TEXT,
    "recommended_actions_ha" TEXT NOT NULL,
    "recommended_actions_en" TEXT,
    "references_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "news_security_advisories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_security_advisories_article_id_key" ON "news_security_advisories"("article_id");

-- CreateIndex
CREATE INDEX "news_security_advisories_severity_idx" ON "news_security_advisories"("severity");

-- AddForeignKey
ALTER TABLE "news_security_advisories" ADD CONSTRAINT "news_security_advisories_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
