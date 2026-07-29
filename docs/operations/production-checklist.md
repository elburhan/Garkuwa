# Production deployment checklist

- [ ] Approved commit/artifact and clean Git state confirmed.
- [ ] `pnpm install --frozen-lockfile`, quality gates, build, and production audit pass.
- [ ] `pnpm env:check` succeeds with the production profile.
- [ ] No placeholder secret, development database, insecure public origin, or local credential is
      present.
- [ ] HTTPS web/API origins and exact credentialed CORS origin confirmed.
- [ ] Secure HttpOnly staff cookie and real proxy trust topology confirmed.
- [ ] Private S3-compatible storage selected; public ACLs/URLs disabled; encryption and least
      privilege reviewed.
- [ ] Database backup completed and verified. Backup owner: [Foundation to assign].
- [ ] Object-storage recovery point and restore procedure confirmed.
- [ ] Pending migration SQL reviewed; `pnpm db:status` recorded.
- [ ] `pnpm db:migrate:deploy` succeeds as a separate release step.
- [ ] API liveness is green and readiness verifies database and storage.
- [ ] Hausa/English public pages and non-destructive release smoke checks pass.
- [ ] Anonymous reporting smoke check uses approved non-sensitive data.
- [ ] Admin login and one authenticated read-only page verified with an approved test identity.
- [ ] Attachment quarantine and lack of public object access verified.
- [ ] Structured logs sampled for request IDs and effective sensitive-data redaction.
- [ ] In-memory limiter/single-instance deployment assumption accepted.
- [ ] Alert ownership assigned: [Foundation to assign].
- [ ] Backup/restore ownership assigned: [Foundation to assign].
- [ ] Incident-response contact assigned: [Foundation to assign].
- [ ] Rollback owner and previous known-good artifact assigned.
- [ ] Retention, legal hold, recovery-time, and recovery-point decisions approved.
- [ ] Release record completed.
