-- CreateEnum
CREATE TYPE "AttachmentReviewSource" AS ENUM ('MANUAL', 'SCANNER');

-- AlterTable
ALTER TABLE "incident_attachments" ADD COLUMN "updated_at" TIMESTAMPTZ(3);
UPDATE "incident_attachments" SET "updated_at" = "uploaded_at";
ALTER TABLE "incident_attachments" ALTER COLUMN "updated_at" SET NOT NULL;

-- CreateTable
CREATE TABLE "incident_attachment_security_reviews" (
    "id" UUID NOT NULL,
    "attachment_id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "reviewed_by_user_id" UUID,
    "decision" "AttachmentStatus" NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "review_source" "AttachmentReviewSource" NOT NULL,
    "scanner_engine" VARCHAR(160),
    "scanner_version" VARCHAR(100),
    "scanner_signature" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_attachment_security_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incident_attachment_security_reviews_attachment_id_key" ON "incident_attachment_security_reviews"("attachment_id");

-- CreateIndex
CREATE INDEX "incident_attachment_security_reviews_attachment_id_created__idx" ON "incident_attachment_security_reviews"("attachment_id", "created_at");

-- CreateIndex
CREATE INDEX "incident_attachment_security_reviews_incident_id_created_at_idx" ON "incident_attachment_security_reviews"("incident_id", "created_at");

-- CreateIndex
CREATE INDEX "incident_attachment_security_reviews_reviewed_by_user_id_cr_idx" ON "incident_attachment_security_reviews"("reviewed_by_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "incident_attachment_security_reviews" ADD CONSTRAINT "incident_attachment_security_reviews_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "incident_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_attachment_security_reviews" ADD CONSTRAINT "incident_attachment_security_reviews_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_attachment_security_reviews" ADD CONSTRAINT "incident_attachment_security_reviews_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
