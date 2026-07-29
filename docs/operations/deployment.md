# Deployment architecture

This runbook describes a controlled release. It is not a substitute for an approved hosting,
network, secret-management, backup, or incident-response design.

## Before deployment

1. Use Node.js 24 and the pinned pnpm version from `package.json`.
2. Provision PostgreSQL with PostGIS and a private S3-compatible bucket. Public bucket access and
   public object URLs must remain disabled. The API identity needs narrowly scoped bucket-head,
   object read, object write, and object delete permissions for that bucket only; KMS permissions
   are also required when `S3_SERVER_SIDE_ENCRYPTION=aws:kms`.
3. Configure HTTPS for the web and API origins. Set the API's exact `WEB_ORIGIN`; wildcard
   credentialed CORS is not supported.
4. Set `TRUST_PROXY=loopback` only when the API is directly behind a trusted loopback proxy.
   Otherwise keep it `false` until the real proxy hop topology is reviewed.
5. Inject secrets through the deployment platform. Never bake `.env`, database credentials,
   contact encryption keys, session material, or object-storage credentials into an image.
6. Confirm a recent database backup and the object-storage recovery process described in
   [backup-and-restore.md](./backup-and-restore.md).

## Build and pre-deploy checks

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm env:check
pnpm db:generate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:status
```

`pnpm db:status` is the safe pre-deploy inspection. Review every pending checked-in migration
before continuing. Production must not use `prisma migrate dev`, `prisma db push`, or
`prisma migrate reset`.

Use [release-runbook.md](./release-runbook.md) for the controlled release sequence and
[rollback-runbook.md](./rollback-runbook.md) for rollback decisions. Those procedures deliberately
keep migration deployment separate from application startup.

During shutdown the API marks readiness unavailable before closing storage and database clients.
The process manager must allow in-flight requests to finish and send `SIGTERM`. After
`SHUTDOWN_GRACE_PERIOD_MS`, remaining HTTP connections are forcibly closed; configure the
orchestrator's termination grace period slightly above this deadline. Do not use an immediate hard
kill as the normal deployment path.
