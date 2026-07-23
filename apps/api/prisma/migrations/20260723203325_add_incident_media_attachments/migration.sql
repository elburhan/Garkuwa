-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('QUARANTINED', 'AVAILABLE', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttachmentAccessType" AS ENUM ('CONTENT_ACCESS');

-- CreateTable
CREATE TABLE "incident_attachments" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "object_key" VARCHAR(255) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "verified_mime_type" VARCHAR(80) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "page_count" INTEGER,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'QUARANTINED',
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "available_at" TIMESTAMPTZ(3),
    "rejected_at" TIMESTAMPTZ(3),
    "rejection_reason" VARCHAR(1000),

    CONSTRAINT "incident_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_attachment_access_history" (
    "id" UUID NOT NULL,
    "attachment_id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "accessed_by_user_id" UUID NOT NULL,
    "access_type" "AttachmentAccessType" NOT NULL DEFAULT 'CONTENT_ACCESS',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_attachment_access_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incident_attachments_object_key_key" ON "incident_attachments"("object_key");

-- CreateIndex
CREATE INDEX "incident_attachments_incident_id_uploaded_at_idx" ON "incident_attachments"("incident_id", "uploaded_at");

-- CreateIndex
CREATE INDEX "incident_attachments_status_uploaded_at_idx" ON "incident_attachments"("status", "uploaded_at");

-- CreateIndex
CREATE INDEX "incident_attachments_sha256_idx" ON "incident_attachments"("sha256");

-- CreateIndex
CREATE INDEX "incident_attachment_access_history_attachment_id_created_at_idx" ON "incident_attachment_access_history"("attachment_id", "created_at");

-- CreateIndex
CREATE INDEX "incident_attachment_access_history_accessed_by_user_id_crea_idx" ON "incident_attachment_access_history"("accessed_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "incident_attachment_access_history_incident_id_created_at_idx" ON "incident_attachment_access_history"("incident_id", "created_at");

-- AddForeignKey
ALTER TABLE "incident_attachments" ADD CONSTRAINT "incident_attachments_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_attachment_access_history" ADD CONSTRAINT "incident_attachment_access_history_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "incident_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_attachment_access_history" ADD CONSTRAINT "incident_attachment_access_history_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_attachment_access_history" ADD CONSTRAINT "incident_attachment_access_history_accessed_by_user_id_fkey" FOREIGN KEY ("accessed_by_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
