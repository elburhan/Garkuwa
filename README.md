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

The database models staff identity plus the first anonymous incident-submission domain. A
Hausa-first public reporting form uses that API, and authenticated staff have a narrowly
controlled incident workflow.
Business functionality will continue to be added incrementally.

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

The web application runs at `http://localhost:3000`; the API runs on port `4000`, and its health
endpoint is `http://localhost:4000/api/health`. The public reporting routes are:

- Hausa (canonical): `http://localhost:3000/rahoton-lamari`
- English: `http://localhost:3000/en/report-incident`

## Anonymous incident-submission foundation

The public form loads approved choices from unauthenticated
`GET /api/public/incident-categories`. The response contains only active categories, ordered by
configured display order and Hausa name, with their public Hausa and English names and optional
descriptions. Category creation and management remain out of scope. No production taxonomy is
seeded: Garkuwa Foundation must configure and approve categories before real use, and any local
development test category is not approved institutional copy.

`POST /api/public/incidents` accepts a validated anonymous incident report and returns only a
generic receipt acknowledgement. Citizens do not need accounts, and the API does not return an
incident ID, internal case ID, status, tracking token, or tracking URL. There is no public case
lookup or tracking workflow.

The submission transaction verifies that the selected category is active, creates the incident
with `NEW` status, optionally creates one separate `incident_contacts` record, and records the
initial status-history transition. Optional contact data is stored only when the reporter
provides a valid phone number or email address and explicitly consents to follow-up. Contact data
is not part of the incident submission response.

The optional contact `name`, `phone`, `email`, and safe-contact instructions are encrypted before
database insertion with AES-256-GCM, a random 12-byte IV per value, and a versioned authenticated
ciphertext format. Incident IDs, contact preference, consent, and timestamps remain ordinary
queryable fields. Decryption is not exposed through any API; it may only be added later through a
restricted and audited staff workflow. Incident descriptions, contact details, ciphertext,
safe-contact instructions, coordinates, encryption keys, and database connection strings must not
be written to application logs.

The endpoint accepts JSON only and uses a 100 KB JSON body limit. Its in-memory protection allows
five submissions per client IP in 15 minutes and rejects an identical normalized submission from
the same IP for five minutes. These controls are per API process and reset on restart. A shared
limiter store is required before running multiple API replicas. Express proxy trust is explicitly
disabled because the production proxy topology is not approved yet; deployment configuration must
be reviewed before trusting any forwarded client-IP header. The HTTP server uses a 10-second
request timeout. CAPTCHA or Turnstile remains a possible later escalation and is not implemented.

No production category taxonomy is seeded. Garkuwa Foundation must approve Hausa and English
category names and descriptions before launch. Tests create or mock their own narrowly scoped
categories. The current endpoint has no media-upload support.

The browser form mirrors the API's text, date, time, coordinate, severity, and optional-contact
validation while leaving the backend authoritative. Submission language comes from the route;
the form does not request device location or retain reports in browser storage. Empty optional
fields are omitted. Contact remains entirely optional and its provided sensitive values are
encrypted by the API before storage. Success confirms only receipt for internal review: there is
no reporter account, public tracking reference, guaranteed outcome, media upload, or emergency
response service.

The additive migration is named `add_incident_submission_domain`. To create an equivalent future
migration for a reviewed schema change and then apply checked-in migrations:

```sh
pnpm db:migrate --name add_incident_submission_domain --create-only
pnpm db:migrate
pnpm db:status
```

## Staff authentication foundation

The unprefixed `/admin/login` route provides Hausa and English staff sign-in, while `/admin` is a
minimal protected landing page.

The API exposes `POST /api/auth/staff/login`, `GET /api/auth/staff/me`, and
`POST /api/auth/staff/logout`. Staff passwords use Argon2id with 19 MiB memory, two iterations,
and one lane. Five failed account attempts cause a temporary 15-minute lock. A separate in-memory
IP limit permits five login requests per 15 minutes per API instance; a shared limiter is required
before horizontal scaling.

Successful login creates a cryptographically random opaque token. Only its SHA-256 hash is stored
in `staff_sessions`; the raw token is sent in the `garkuwa_staff_session` cookie with `HttpOnly`,
`SameSite=Lax`, and `Path=/`. Sessions have an absolute eight-hour expiry, are not sliding, and
are revoked on logout or password change. The cookie is not available to browser JavaScript, and
the web application stores no JWT or authentication token in localStorage or sessionStorage.

Set `STAFF_SESSION_COOKIE_SECURE=false` only for local HTTP development. Production must use HTTPS
and set it to `true`. Login and logout reject requests whose `Origin` does not exactly match the
validated `WEB_ORIGIN`; CORS uses that same single origin with credentials and never uses a
wildcard. Production deployment must keep the web and API cookie topology on the same trusted
site so server-rendered admin pages can forward the cookie for session verification.

No default staff password or user is created. To set or replace the password of an existing staff
row, provide the password temporarily through the process environment and identify the existing
normalized email explicitly:

```powershell
$env:STAFF_BOOTSTRAP_PASSWORD = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText
pnpm staff:set-password --email staff@example.org
Remove-Item Env:STAFF_BOOTSTRAP_PASSWORD
```

On macOS or Linux, use a temporary environment variable without placing the value in shell
history where possible. The command never prints the password, refuses unknown users, resets the
temporary lock, and revokes existing sessions. There is no registration, password reset, email
verification, MFA, OAuth, social login, remember-me session, or refresh token yet. MFA and password
recovery require separate reviewed workflows before production readiness.

## Incident moderation and controlled workflow

Authenticated staff can use `/admin/incidents` and `/admin/incidents/:incidentId` to review the
incident queue and individual incident records. The corresponding API endpoints are
`GET /api/admin/incidents` and `GET /api/admin/incidents/:incidentId`.

Access is limited to `SUPER_ADMIN`, `ADMIN`, `MODERATOR`, and `ANALYST`. Authenticated `EDITOR`
users receive `403 Forbidden`, and unauthenticated requests receive `401 Unauthorized`.
Authorization is enforced by the API in addition to the web interface.

The queue defaults to page 1 with 20 records and enforces a maximum page size of 100. Supported
filters are status, severity, category, submission language, state, LGA, submitted-date range, and
a bounded search over case ID and location fields. Sorting is limited to newest, oldest, severity,
or status, with a deterministic incident-ID secondary sort. There is no unrestricted export.

The detail view includes report text, ordered status history, and ordered assignment history,
rendered as plain text. `SUPER_ADMIN`, `ADMIN`, and `MODERATOR` may perform approved status
transitions through `PATCH /api/admin/incidents/:incidentId/status`. Only `SUPER_ADMIN` and
`ADMIN` may assign, reassign, or unassign through
`PATCH /api/admin/incidents/:incidentId/assignment`; those roles may also query the bounded
`GET /api/admin/incidents/eligible-assignees` list. `ANALYST` access remains read-only.

The approved transitions are:

```text
NEW -> UNDER_REVIEW | REJECTED
UNDER_REVIEW -> ACTIONED | CLOSED | REJECTED
ACTIONED -> UNDER_REVIEW | CLOSED
CLOSED -> UNDER_REVIEW
REJECTED -> UNDER_REVIEW
```

Rejecting or reopening a closed/rejected incident requires a reason. Assignment to the current
assignee is rejected as no change. Every successful status change and assignment change writes
its matching audit-history row in the same database transaction. Both mutation endpoints require
the incident's exact millisecond-precision `updatedAt`; stale changes return `409 Conflict` and
must be refreshed. Browser mutations require strict JSON and an `Origin` exactly matching
`WEB_ORIGIN`.

Ordinary queue/detail queries use explicit Prisma selections and never select the incident
contact relation, encrypted contact values, staff security fields, or session data.

### Restricted reporter contact access

Only `SUPER_ADMIN` and `ADMIN` may request reporter contact information through
`POST /api/admin/incidents/:incidentId/contact-access` or read the incident-specific audit list at
`GET /api/admin/incidents/:incidentId/contact-access-history`. `MODERATOR`, `ANALYST`, and
`EDITOR` cannot infer contact availability from their ordinary incident views.

Reveal requests require strict JSON, an exact trusted `Origin`, and a 10–1000 character operational
reason. The API decrypts present contact fields with the existing AES-256-GCM service and writes a
successful `incident_contact_access_history` row in the same transaction only after decryption
succeeds. Audit rows contain the actor, incident, contact reference, reason, and timestamp—not
plaintext or ciphertext snapshots. Viewing contact information does not change incident
`updatedAt`.

The admin panel requires an explicit acknowledgement before reveal. Decrypted values remain only
in component memory, use `cache: no-store`, can be hidden immediately, and are automatically
hidden after two minutes. They are never placed in URLs, browser storage, exports, clipboard
automation, or server-rendered HTML. Reveal attempts are limited to 10 per staff user per 15
minutes per API instance. A shared rate-limit store is required before horizontally scaling the
API.

Contact encryption-key rotation, recovery, production secret management, and operational access
review remain deployment responsibilities. This phase adds no bulk reveal, export, reporter
messaging, staff notes, arbitrary incident editing, deletion, media, maps, notifications,
analytics, or public tracking. It is not a claim of production readiness.

## Environment variables

Create `.env` only at the repository root. Next.js and Prisma resolve that file from their
configuration locations; the compiled API locates the workspace root by its
`pnpm-workspace.yaml`. Web values exposed to browser code use the `NEXT_PUBLIC_` prefix.
`DATABASE_URL` and `WEB_ORIGIN` remain server-only. Both applications validate required values
with Zod and fail with a readable error when configuration is missing or invalid. Never commit
`.env`.

`CONTACT_DATA_ENCRYPTION_KEY` is required by the API and must be canonical base64 representing
exactly 32 random bytes. Generate a development key locally, place only its output in the ignored
root `.env`, and use a separately managed production secret:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Do not commit generated keys or reuse development keys in production. Losing the key makes the
encrypted contact values unrecoverable.

`STAFF_SESSION_COOKIE_SECURE` is also required and accepts only `true` or `false`. Use `false` for
local HTTP development and `true` for every HTTPS production deployment.

`NEXT_PUBLIC_API_BASE_URL` must be the public API prefix, such as
`http://localhost:4000/api` for local development. The web client validates this URL and safely
normalizes a trailing slash. Production deployment can override it without changing components;
never place database credentials or other backend secrets in a `NEXT_PUBLIC_` variable.

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
pnpm staff:set-password --email staff@example.org # explicitly set an existing staff password
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
validation, database connectivity, local tooling, foundational tests, anonymous incident
submission, secure staff authentication, controlled incident workflow, and restricted audited
contact access described above. It intentionally does **not** implement public tracking, reporter
accounts, bulk contact reveal, contact export, staff notes, arbitrary incident editing or
deletion, media uploads, device-location
access, maps, production category management, news or editorial workflows, dashboards, analytics,
object storage, notifications, Redis, queues, outbox events, audit-log business logic, Kubernetes,
microservices, or Kafka. The platform remains an incremental foundation and is not a claim of
production readiness.
