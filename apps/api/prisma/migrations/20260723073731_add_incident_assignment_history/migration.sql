-- CreateTable
CREATE TABLE "incident_assignment_history" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "from_user_id" UUID,
    "to_user_id" UUID,
    "changed_by_user_id" UUID NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_assignment_history_incident_id_created_at_idx" ON "incident_assignment_history"("incident_id", "created_at");

-- CreateIndex
CREATE INDEX "incident_assignment_history_from_user_id_idx" ON "incident_assignment_history"("from_user_id");

-- CreateIndex
CREATE INDEX "incident_assignment_history_to_user_id_idx" ON "incident_assignment_history"("to_user_id");

-- CreateIndex
CREATE INDEX "incident_assignment_history_changed_by_user_id_idx" ON "incident_assignment_history"("changed_by_user_id");

-- AddForeignKey
ALTER TABLE "incident_assignment_history" ADD CONSTRAINT "incident_assignment_history_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_assignment_history" ADD CONSTRAINT "incident_assignment_history_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_assignment_history" ADD CONSTRAINT "incident_assignment_history_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_assignment_history" ADD CONSTRAINT "incident_assignment_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
