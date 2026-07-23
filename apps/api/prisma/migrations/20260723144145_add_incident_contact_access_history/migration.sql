-- CreateTable
CREATE TABLE "incident_contact_access_history" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "accessed_by_user_id" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_contact_access_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_contact_access_history_incident_id_created_at_idx" ON "incident_contact_access_history"("incident_id", "created_at");

-- CreateIndex
CREATE INDEX "incident_contact_access_history_accessed_by_user_id_created_idx" ON "incident_contact_access_history"("accessed_by_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "incident_contact_access_history" ADD CONSTRAINT "incident_contact_access_history_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_contact_access_history" ADD CONSTRAINT "incident_contact_access_history_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "incident_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_contact_access_history" ADD CONSTRAINT "incident_contact_access_history_accessed_by_user_id_fkey" FOREIGN KEY ("accessed_by_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
