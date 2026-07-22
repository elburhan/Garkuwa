# Garkuwa Platform

Production-minded foundation for the Garkuwa Foundation's Hausa-first bilingual platform.
Hausa is the canonical public language at `/`; English is secondary at `/en`. The future
`/admin` area lives in the same Next.js application. The NestJS API is a modular monolith.

## Architecture

- `apps/web`: Next.js App Router application for public and future internal routes.
- `apps/api`: NestJS modular-monolith API with configured Prisma database connectivity.
- `packages/i18n`: shared Hausa-first locale constants and independently authored messages.
- `packages/config`: strict TypeScript and shared ESLint configuration.
- `infrastructure`: local PostGIS-capable PostgreSQL 17 server through Docker Compose.

The database models staff identity plus the first anonymous incident-submission domain. The
incident endpoint is a backend foundation only; no public reporting form or staff moderation
workflow exists yet. Business functionality will continue to be added incrementally.

## Prerequisites

- Node.js 24 LTS
- Corepack with pnpm 10
- Docker Desktop or Docker Engine with Compose

## Repository structure

```text
apps/
  api/                 NestJS API and Prisma schema
  web/                 Next.js application
packages/
  config/              Shared tool configuration
  i18n/                Locale constants and message resources
infrastructure/        Local Docker Compose configuration
.github/workflows/     CI verification
```

## Local setup

1. Copy the example environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

   On macOS or Linux use `cp .env.example .env`.

2. Review the non-secret local values in the repository-root `.env`, then start the
   PostGIS-capable PostgreSQL server:

   ```sh
   corepack enable
   pnpm docker:up
   ```

   If Docker is unavailable, install Docker Desktop or Docker Engine with Compose support and
   ensure the `docker` command is available on your PATH. The wrapper will report that requirement
   clearly if the binary is missing.

3. Install dependencies and generate Prisma Client:

   ```sh
   pnpm install
   pnpm db:generate
   ```

4. Apply the checked-in initial migration to the running local database:

   ```sh
   pnpm db:migrate
   ```

   The initial migration was manually prepared from Prisma 7.9's empty-to-schema diff and is
   already applied in the local PostgreSQL database. Its first statement activates PostGIS:

   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

   Check migration status after applying it:

   ```sh
   pnpm db:status
   ```

   Verify database reachability and PostGIS activation before treating the environment as ready:

   ```sh
   pnpm db:verify
   ```

   The Docker image contains PostGIS binaries, and the local database has already been verified
   to support the `postgis` extension in the application schema. The checked-in initial migration
   has already been applied, and the local `staff_users` table is present.

   If the database is unavailable, the migration commands now exit with an actionable message and
   point you to the local Docker and verification commands:

   ```sh
   pnpm docker:up
   pnpm db:verify
   ```

   For later schema changes, generate a migration without applying it, review its SQL, and then
   apply it:

   ```sh
   pnpm db:migrate --name describe_the_change --create-only
   pnpm db:migrate
   ```

5. Start both applications:

   ```sh
   pnpm dev
   ```

The web application runs at `http://localhost:3000`; the health endpoint is
`http://localhost:4000/api/health`.

## Anonymous incident-submission foundation

`POST /api/public/incidents` accepts a validated anonymous incident report and returns only a
generic receipt acknowledgement. Citizens do not need accounts, and the API does not return an
incident ID, internal case ID, status, tracking token, or tracking URL. There is no public case
lookup or tracking workflow.

The submission transaction verifies that the selected category is active, creates the incident
with `NEW` status, optionally creates one separate `incident_contacts` record, and records the
initial status-history transition. Optional contact data is stored only when the reporter
provides a valid phone number or email address and explicitly consents to follow-up. Contact data
is not part of the incident submission response.

Optional contact fields are currently stored as ordinary database columns. Encryption at rest
for those restricted fields must be designed, approved, and implemented before production use;
this repository does not claim that application-level encryption exists. Production-approved
rate limiting and anti-abuse controls are also required before launch. Incident descriptions,
contact details, safe-contact instructions, and coordinates must not be written to application
logs.

No production category taxonomy is seeded. Garkuwa Foundation must approve Hausa and English
category names and descriptions before launch. Tests create or mock their own narrowly scoped
categories. The current endpoint has no media-upload support.

The additive migration is named `add_incident_submission_domain`. To create an equivalent future
migration for a reviewed schema change and then apply checked-in migrations:

```sh
pnpm db:migrate --name add_incident_submission_domain --create-only
pnpm db:migrate
pnpm db:status
```

## Environment variables

Create `.env` only at the repository root. Next.js and Prisma resolve that file from their
configuration locations; the compiled API locates the workspace root by its
`pnpm-workspace.yaml`. Web values exposed to browser code use the `NEXT_PUBLIC_` prefix.
`DATABASE_URL` and `WEB_ORIGIN` remain server-only. Both applications validate required values
with Zod and fail with a readable error when configuration is missing or invalid. Never commit
`.env`.

## Commands

```sh
pnpm dev             # run web and API in watch mode
pnpm build           # build all workspaces
pnpm lint            # lint all workspaces
pnpm typecheck       # type-check all workspaces
pnpm test            # run foundational tests
pnpm format          # format repository files
pnpm format:check    # verify formatting
pnpm db:generate     # generate Prisma Client
pnpm db:migrate      # create or apply a development migration against a live database
pnpm db:status       # compare checked-in migrations with a live database
pnpm db:verify       # verify PostgreSQL reachability and PostGIS activation
pnpm db:studio       # open Prisma Studio
pnpm docker:up       # start PostgreSQL/PostGIS
pnpm docker:down     # stop PostgreSQL/PostGIS
```

The Docker volume `garkuwa_postgres_data` persists database data. `docker:down` does not delete
it. Starting the container does not prove that migrations ran or that the application can
connect. No live database is needed for Prisma Client generation, schema validation, linting,
type-checking, foundation tests, or application builds; running the API itself does require a
reachable, migrated PostgreSQL database.

`GET /api/health` reports only application-process health with `status`, `service`, and an
ISO-8601 `timestamp`. It does not perform or claim a database health check.

## Staff email identity requirement

The future authentication service must trim staff email addresses and normalize them to
lowercase before both insertion and lookup. It must not rely only on PostgreSQL's ordinary,
case-sensitive unique constraint for case-insensitive identity. Authentication and
password-handling services are intentionally not implemented at this stage.

## Verification boundaries

The checked-in Prisma schema and manually prepared initial migration define the intended staff
identity shape, and the local database has already been verified for connectivity, PostGIS,
and the initial migration. The CI workflow validates the schema indirectly by generating Prisma
Client and completes formatting, linting, type-checking, tests, and builds using safe
placeholder URLs. It does not start PostgreSQL or run migrations.

## Current scope

This repository contains application bootstrapping, bilingual public pages, environment
validation, database connectivity, local tooling, foundational tests, and the anonymous incident
submission backend described above. It intentionally does **not** implement a public reporting
form, public tracking, reporter accounts, incident listing or moderation, staff authentication,
news or editorial workflows, dashboards, analytics, maps, uploads, object storage, notifications,
Redis, queues, outbox events, audit-log business logic, Kubernetes, microservices, or Kafka.
