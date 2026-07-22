-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'ACTIONED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubmissionLanguage" AS ENUM ('ha', 'en');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "PreferredContactMethod" AS ENUM ('PHONE', 'EMAIL');

-- CreateTable
CREATE TABLE "incident_categories" (
    "id" UUID NOT NULL,
    "name_ha" VARCHAR(160) NOT NULL,
    "name_en" VARCHAR(160) NOT NULL,
    "description_ha" VARCHAR(500),
    "description_en" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "incident_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "internal_case_id" VARCHAR(17) NOT NULL,
    "category_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "incident_date" DATE,
    "incident_time" TIME(0),
    "location_description" VARCHAR(500),
    "state" VARCHAR(100),
    "lga" VARCHAR(100),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(10,6),
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'NEW',
    "submission_language" "SubmissionLanguage" NOT NULL,
    "assigned_to_user_id" UUID,
    "duplicate_of_incident_id" UUID,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "closed_at" TIMESTAMPTZ(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "incidents_coordinates_pair_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
    CONSTRAINT "incidents_latitude_range_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
    CONSTRAINT "incidents_longitude_range_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
    CONSTRAINT "incidents_not_own_duplicate_check" CHECK ("duplicate_of_incident_id" IS NULL OR "duplicate_of_incident_id" <> "id")
);

-- CreateTable
CREATE TABLE "incident_contacts" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "name" VARCHAR(160),
    "phone" VARCHAR(32),
    "email" VARCHAR(320),
    "preferred_contact_method" "PreferredContactMethod" NOT NULL,
    "safe_contact_instructions" VARCHAR(500),
    "consent_to_contact" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_contacts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "incident_contacts_consent_check" CHECK ("consent_to_contact" = true),
    CONSTRAINT "incident_contacts_method_available_check" CHECK (
        ("preferred_contact_method" = 'PHONE' AND "phone" IS NOT NULL) OR
        ("preferred_contact_method" = 'EMAIL' AND "email" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "incident_status_history" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "from_status" "IncidentStatus",
    "to_status" "IncidentStatus" NOT NULL,
    "changed_by_user_id" UUID,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incident_categories_name_ha_key" ON "incident_categories"("name_ha");

-- CreateIndex
CREATE UNIQUE INDEX "incident_categories_name_en_key" ON "incident_categories"("name_en");

-- CreateIndex
CREATE INDEX "incident_categories_is_active_display_order_idx" ON "incident_categories"("is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_internal_case_id_key" ON "incidents"("internal_case_id");

-- CreateIndex
CREATE INDEX "incidents_category_id_status_idx" ON "incidents"("category_id", "status");

-- CreateIndex
CREATE INDEX "incidents_status_severity_submitted_at_idx" ON "incidents"("status", "severity", "submitted_at");

-- CreateIndex
CREATE INDEX "incidents_assigned_to_user_id_idx" ON "incidents"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "incidents_duplicate_of_incident_id_idx" ON "incidents"("duplicate_of_incident_id");

-- CreateIndex
CREATE UNIQUE INDEX "incident_contacts_incident_id_key" ON "incident_contacts"("incident_id");

-- CreateIndex
CREATE INDEX "incident_status_history_incident_id_created_at_idx" ON "incident_status_history"("incident_id", "created_at");

-- CreateIndex
CREATE INDEX "incident_status_history_changed_by_user_id_idx" ON "incident_status_history"("changed_by_user_id");

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "incident_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_duplicate_of_incident_id_fkey" FOREIGN KEY ("duplicate_of_incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_contacts" ADD CONSTRAINT "incident_contacts_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_status_history" ADD CONSTRAINT "incident_status_history_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_status_history" ADD CONSTRAINT "incident_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
