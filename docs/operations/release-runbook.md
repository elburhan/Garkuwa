# Release runbook

This is the controlled release sequence. It does not authorize production access or replace
Foundation approval of hosting, retention, recovery objectives, or incident-response ownership.

## Prerequisites

1. Confirm the approved commit and a clean Git working tree.
2. Confirm Node.js 24 and the pnpm version pinned in `package.json`.
3. Confirm reviewed production configuration, HTTPS, exact CORS origin, proxy trust, Secure staff
   cookies, a private S3-compatible bucket, and production PostgreSQL/PostGIS.
4. Confirm assigned release, backup, rollback, and incident-response owners.
5. Take and verify the approved pre-release database backup. Confirm the matching private-object
   recovery point under [backup-and-restore.md](./backup-and-restore.md).

## Validate and build

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm env:check
pnpm db:generate
pnpm db:verify
pnpm db:status
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --prod
git diff --check
```

Review every pending committed migration. Production must never use `prisma migrate dev`,
`prisma db push`, or `prisma migrate reset`.

## Release sequence

1. Deploy the approved artifacts and configuration to staging with separate secrets, database,
   bucket, origins, and staff sessions.
2. Run `pnpm db:migrate:deploy`. A failed preflight or migration blocks promotion.
3. Deploy the API without routing production traffic to it.
4. Confirm `/api/health/live` responds and `/api/health/ready` becomes ready only after PostgreSQL
   and the configured private storage adapter initialize.
5. Deploy the web application and route traffic only after readiness is green.
6. Run the non-destructive public smoke checks:

   ```sh
   SMOKE_API_BASE_URL=https://api.example.org/api \
   SMOKE_WEB_BASE_URL=https://www.example.org \
   pnpm release:smoke
   ```

7. Manually verify staff login/logout and one authenticated read-only admin page using an approved
   test identity. Verify anonymous reporting and attachment quarantine with approved non-sensitive
   staging fixtures; do not upload production evidence as a smoke test.
8. Sample structured logs for request IDs, status, duration, and effective redaction. Confirm no
   sensitive values or payloads are present.
9. Record the commit/artifact, environment profile, migration status, backup reference, smoke
   result, health result, operator, time, and any accepted exceptions in the release record.

## Promotion and incident decision

Observe health, safe error counts, storage availability, and logs during the agreed release
window. If readiness fails, migrations fail, restricted information appears in logs, or product
behaviour regresses, stop promotion and invoke [rollback-runbook.md](./rollback-runbook.md).
