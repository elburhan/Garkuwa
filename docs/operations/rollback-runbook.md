# Rollback runbook

Rollback requires an explicit incident decision and an assigned operator. Preserve logs and other
forensic evidence. Do not improvise reverse SQL or delete evidence objects.

## Application rollback

1. Stop promotion and identify the previous known-good immutable artifact or commit.
2. Determine whether that application version is compatible with the database schema currently
   deployed and with the existing private-object layout.
3. When compatible, deploy the previous application artifacts without changing the database.
4. Confirm liveness, readiness, public smoke checks, authenticated read-only access, quarantine,
   and log safety.
5. Record the decision, operator, timestamps, affected artifacts, observed symptoms, and outcome.

Application rollback never deletes evidence uploaded by the newer release. Private object keys and
ACLs must remain compatible and private.

## Database decision

Prisma migrations are forward-oriented. Do not:

- edit an applied migration;
- delete rows from `_prisma_migrations`;
- run `prisma migrate reset` or `prisma db push`;
- apply unreviewed reverse SQL.

Prefer a reviewed forward corrective migration. If restoration is the approved incident decision,
stop writes, preserve evidence and logs, and follow [backup-and-restore.md](./backup-and-restore.md).
Restore into a separate verification database first whenever circumstances permit. Confirm
PostGIS, migration status, expected row counts, application readiness, and private-object
consistency before any production replacement.

Recovery-time and recovery-point objectives, acceptable data loss, legal hold, and authority to
restore are Foundation decisions and are not guaranteed by this repository.

## Object storage

Do not delete newly stored objects merely because application code is rolled back. Confirm the
rolled-back application understands the current object-key layout and encryption policy. If it
does not, keep content access unavailable until a reviewed compatible release is deployed.
