-- CreateTable
CREATE TABLE "incident_staff_notes" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "edited_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_user_id" UUID,
    "deletion_reason" VARCHAR(1000),

    CONSTRAINT "incident_staff_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_staff_note_revisions" (
    "id" UUID NOT NULL,
    "note_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "changed_by_user_id" UUID NOT NULL,
    "change_reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_staff_note_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_staff_notes_incident_id_created_at_idx" ON "incident_staff_notes"("incident_id", "created_at");

-- CreateIndex
CREATE INDEX "incident_staff_notes_author_user_id_created_at_idx" ON "incident_staff_notes"("author_user_id", "created_at");

-- CreateIndex
CREATE INDEX "incident_staff_notes_deleted_at_idx" ON "incident_staff_notes"("deleted_at");

-- CreateIndex
CREATE INDEX "incident_staff_note_revisions_note_id_created_at_idx" ON "incident_staff_note_revisions"("note_id", "created_at");

-- CreateIndex
CREATE INDEX "incident_staff_note_revisions_changed_by_user_id_created_at_idx" ON "incident_staff_note_revisions"("changed_by_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "incident_staff_note_revisions_note_id_revision_number_key" ON "incident_staff_note_revisions"("note_id", "revision_number");

-- AddForeignKey
ALTER TABLE "incident_staff_notes" ADD CONSTRAINT "incident_staff_notes_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_staff_notes" ADD CONSTRAINT "incident_staff_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_staff_notes" ADD CONSTRAINT "incident_staff_notes_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_staff_note_revisions" ADD CONSTRAINT "incident_staff_note_revisions_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "incident_staff_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_staff_note_revisions" ADD CONSTRAINT "incident_staff_note_revisions_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
