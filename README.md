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
limiter store is required before running multiple API replicas. Proxy trust defaults to disabled;
`TRUST_PROXY=loopback` may be used only when that matches the reviewed deployment topology.
There is no global request timeout that would interrupt bounded multipart uploads. CAPTCHA or
Turnstile remains a possible later escalation and is not implemented.

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
protected read-only operations dashboard.

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

No default staff password or user is created. For a new local or test database only, the supported
first-account command creates exactly one active `SUPER_ADMIN`. It refuses production
configuration and refuses to run when any staff row already exists.

1. Start PostgreSQL, apply migrations, and verify the database:

   ```powershell
   pnpm docker:up
   pnpm db:migrate:deploy
   pnpm db:verify
   pnpm db:status
   ```

2. Confirm that the staff table is empty with a count-only query:

   ```powershell
   docker compose --env-file .env -f infrastructure/docker-compose.yml exec -T postgres `
     psql -U garkuwa -d garkuwa -tAc "SELECT COUNT(*) FROM staff_users;"
   ```

   The command uses the repository's example database name and user; adjust both if your local
   `.env` changes them. The result must be `0`. The CLI repeats this check inside a serializable
   transaction immediately before creation.

3. Capture a 12–128 character local password without placing it in shell history, create the
   account, and immediately clear the temporary process variable:

   ```powershell
   $env:STAFF_BOOTSTRAP_PASSWORD = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText
   pnpm staff:create-first-admin `
     --email local.admin@garkuwa.test `
     --display-name "Local Administrator"
   Remove-Item Env:STAFF_BOOTSTRAP_PASSWORD
   ```

4. Start the API and web applications, then open
   `http://localhost:3000/admin/login`.

`staff:create-first-admin` never creates a session or default credentials, never accepts the
password as a command-line argument, and is not run during application startup. It is limited to
the first local/test account, requires `DEPLOYMENT_ENV=local` or `DEPLOYMENT_ENV=test` explicitly,
and records ordinary account creation/password timestamps without logging the password. Run it
through the deployment operator's normal audited shell or runbook so the provisioning action is
traceable. Subsequent staff provisioning requires a separately reviewed administrative workflow.
There is no production override.

To set or replace the password of an already-existing staff row, provide the password temporarily
through the process environment and identify the existing normalized email explicitly:

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

## Administrative operations dashboard

Authenticated `SUPER_ADMIN`, `ADMIN`, `MODERATOR`, and `ANALYST` staff can use `/admin` and
`GET /api/admin/dashboard/operations`. `EDITOR` is denied. Supported ranges are `7d`, `30d`, and
`90d`, with `30d` as the default. Ranges represent trailing UTC calendar days including the
current UTC date; the current workload cards and distributions always describe current database
state.

The overview defines open incidents as `NEW`, `UNDER_REVIEW`, or `ACTIONED`. Unassigned counts
include only those same open statuses. `CLOSED` and `REJECTED` remain separate. Status and severity
distributions include every enum value, including zero counts. Daily submission trends are
grouped by `submittedAt` using UTC dates and missing dates are filled with zero.

Assignment workload includes active `SUPER_ADMIN`, `ADMIN`, and `MODERATOR` staff and counts only
their open assigned incidents. It is an operational allocation summary, not a productivity or
performance ranking. Results are capped at 50 after querying at most 500 active eligible staff,
which assumes the initial deployment has a bounded staff directory.

Attachment workload contains only current `QUARANTINED`, `AVAILABLE`, and `REJECTED` counts.
Recent activity is capped at 20 entries and combines incident submissions, status changes,
assignment changes, and attachment-review decisions. It exposes only case identifiers, minimal
actor names, timestamps, status/assignment changes, and attachment decisions.

Dashboard queries never select incident descriptions, locations, coordinates, contact data or
access reasons, staff-note content or reasons, attachment filenames/keys/hashes, security-review
reasons, email addresses, sessions, or password fields. Responses use private no-store caching.
There is no public dashboard, export, polling, map, contact metric, productivity score,
predictive analytics, AI summary, third-party telemetry, snapshot table, or schema migration.
This read-only operational view is not a production-readiness claim.

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
messaging, arbitrary incident editing, deletion, media, maps, notifications,
analytics, or public tracking. It is not a claim of production readiness.

### Internal incident staff notes

Authenticated incident records expose a separate internal-notes workflow:

- `GET /api/admin/incidents/:incidentId/notes` is available to `SUPER_ADMIN`, `ADMIN`,
  `MODERATOR`, and `ANALYST`.
- `POST /api/admin/incidents/:incidentId/notes` is available to `SUPER_ADMIN`, `ADMIN`, and
  `MODERATOR`.
- `PATCH /api/admin/incidents/:incidentId/notes/:noteId` permits an author to correct their own
  note within 15 minutes. After that boundary, only `SUPER_ADMIN` and `ADMIN` may correct it and
  must give a 10–1000 character administrative reason.
- `POST /api/admin/incidents/:incidentId/notes/:noteId/redact` soft-redacts a note and is limited
  to `SUPER_ADMIN` and `ADMIN`; a reason is mandatory.
- `GET /api/admin/incidents/:incidentId/notes/:noteId/revisions` is the restricted immutable
  revision view for `SUPER_ADMIN` and `ADMIN`.

Note text is trimmed only at its outer edges, remains plain text, and is limited to 5000
characters. Creation writes the note and revision 1 atomically without changing the incident,
status, assignment, or incident `updatedAt`. Corrections use a conditional version update;
stale versions return `409 Conflict`, and every successful correction adds a revision without
changing authorship. Redaction increments the version and records the actor, reason, timestamp,
and retained body in immutable history, while ordinary lists return only a tombstone and never
the deleted body or reason. Repeated redaction is safely rejected; there is no restore or
physical-delete endpoint.

All note mutations require strict JSON, an exact trusted `Origin`, and a valid staff session.
They are limited to 30 mutations per staff user per 15 minutes per API instance. A shared
limiter store is required before horizontally scaling the API. Notes are internal and never
loaded by public routes. Staff must not copy reporter contact information into notes; that data
has a separate restricted, audited workflow. This phase includes no encryption claim for note
text and no attachments, rich text, Markdown rendering, mentions, notifications, messaging,
search, export, analytics, or public tracking. It is not a claim of production readiness.

### Private incident evidence attachments

`POST /api/public/incidents` remains the text-only JSON path. When evidence is selected, the form
uses `POST /api/public/incidents/with-attachments` with one `report` JSON field and repeated
`attachments` fields. Both routes remain anonymous, share the per-IP attempt budget and duplicate
fingerprint, and return no IDs, hashes, statuses, object keys, public URLs, or tracking data.

V1 accepts only signature-verified JPEG, PNG, WebP, and PDF: at most five files, 10 MiB each and
25 MiB combined. The API sanitizes display filenames, generates non-identifying keys, calculates
SHA-256 over exact bytes, and extracts supported image dimensions. PDF page count remains unset.
Original bytes are preserved; EXIF/GPS display, OCR, classification, face recognition,
thumbnails, transformations, audio, video, SVG, Office files, archives, and analysis are excluded.

The filesystem adapter writes development files beneath `INCIDENT_STORAGE_FILESYSTEM_ROOT`,
outside public web assets. Production should use `INCIDENT_STORAGE_DRIVER=s3` with the private
S3-compatible adapter and separately managed credentials. Neither adapter creates public URLs.
Storage precedes the database transaction. Database failure triggers best-effort object cleanup,
while storage failure creates no incident. Process termination between storage and compensation
can leave an orphan requiring operational cleanup.

Attachments start `QUARANTINED`. Malware scanning is not integrated, and there is no fake clean
result or scan-bypass endpoint. Authenticated incident viewers may list safe metadata at
`GET /api/admin/incidents/:incidentId/attachments`. Only `SUPER_ADMIN`, `ADMIN`, and `MODERATOR`
may request `AVAILABLE` content at
`GET /api/admin/incidents/:incidentId/attachments/:attachmentId/content`; `ANALYST` is
metadata-only. Each authorized content initiation creates an audit row. Delivery is private,
no-store, `nosniff`, CSP-restricted, and uses attachment disposition. It does not prove download
completion.

`SUPER_ADMIN` and `ADMIN` may make one terminal manual security-review decision through
`PATCH /api/admin/incidents/:incidentId/attachments/:attachmentId/security-review`.
Only `QUARANTINED → AVAILABLE` and `QUARANTINED → REJECTED` are permitted; completed decisions
cannot be reopened or reversed. Every decision requires a 10–1000 character reason, the
attachment's current `updatedAt` value, strict JSON, an exact trusted `Origin`, and an
acknowledgement in the web interface. A stale timestamp returns `409 Conflict`. The conditional
attachment update and immutable review record are committed in one transaction.

Review history is available to authenticated incident readers at
`GET /api/admin/incidents/:incidentId/attachments/:attachmentId/security-reviews`.
`SUPER_ADMIN` and `ADMIN` see the approved review reason; `MODERATOR` and `ANALYST` see the
decision, source, date, and minimal reviewer identity with the reason withheld. `EDITOR` remains
blocked. Review mutations are limited to 20 attempts per staff user per 15 minutes per API
instance; horizontal scaling will require a shared limiter store.

Manual approval means only “approved for controlled staff access.” It is not proof that a file
is virus-free, malware-free, or completely safe. Quarantined content remains unavailable through
the application, including to reviewers. Until a trusted scanner is integrated, examination must
occur through an institutionally approved isolated process outside the ordinary content-delivery
endpoint. The code defines only a future scanner interface: no provider, automatic `CLEAN`
decision, callback, webhook, scheduled job, or quarantine bypass exists. Future scanner
authentication and operational policy remain pending.

Staff notes do not accept files. There is no public gallery, reporter tracking, staff upload,
bulk review, bulk download, attachment deletion UI, messaging, or notification. Evidence
retention and deletion rules require institutional/legal approval; no retention period is
invented. This is not a production-readiness claim.

## Internal news editorial foundation

The verified-information side now has an authenticated, internal-only editorial workflow. Admin
routes are `/admin/news`, `/admin/news/new`, and `/admin/news/:articleId`. The API endpoints are:

- `GET /api/admin/news`
- `POST /api/admin/news`
- `GET /api/admin/news/:articleId`
- `PATCH /api/admin/news/:articleId`
- `PATCH /api/admin/news/:articleId/status`
- `GET /api/admin/news/:articleId/history`

`SUPER_ADMIN`, `ADMIN`, `EDITOR`, and `MODERATOR` may read the article list and details;
`ANALYST` is denied. Administrators and editors may create drafts. Editors may edit and submit only
their own drafts. Moderators may return an in-review article for correction, while only
administrators may approve publication or archive an approved article.

The lifecycle is `DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED`, with the controlled return
`IN_REVIEW → DRAFT`. Returning requires a review reason. All other transitions are rejected, and
archived records are terminal. Every mutation requires the caller's `expectedUpdatedAt`; stale
mutations return `409 Conflict`. Status changes and immutable history entries are committed in one
transaction.

Hausa title, summary, and plain-text body are required and canonical. English is optional, but its
title, summary, and body must be supplied together. Slugs are generated once from the Hausa title,
transliterating Hausa Latin letters and adding a bounded numeric suffix for collisions. Slugs stay
stable when draft titles change.

`PUBLISHED` means editorially approved for public delivery. The read-only public delivery rules are
described below. Articles now support the controlled structured blocks and newsroom images described
below, but there is still no arbitrary HTML or Markdown storage, scheduled publication, article
deletion, autosave, analytics, notification, or AI writing/translation feature.

Editorial mutations use the existing trusted-origin protection and a per-instance in-memory limit
of 60 attempts per staff user per 15 minutes. A shared limiter store would be required for multiple
API replicas. This internal foundation is not a claim of production readiness.

## Public news delivery

Published public information is available at the canonical Hausa routes `/news` and
`/news/:slug`. Complete English translations are available at `/en/news` and
`/en/news/:slug`; there is no `/ha/news` route and English never falls back to Hausa. The
homepages show up to three recent articles while retaining the incident-reporting call to action.

The unauthenticated, read-only API endpoints are:

- `GET /api/public/news?lang=ha&page=1&pageSize=10`
- `GET /api/public/news/:slug?lang=ha`

`lang` accepts only `ha` or `en`. Pagination defaults to 10 items and is capped at 30. Results
are ordered by `publishedAt` descending and then stable slug order. API queries directly require
`status = PUBLISHED`, a non-null publication timestamp no later than the current server time,
and—for English responses—all three English fields. Draft, in-review, archived, future-dated,
missing-date, incomplete-translation, and unknown records share the same public not-found
behavior. No internal article ID, staff identity, editorial history, workflow reason, or internal
timestamp is selected or returned.

Successful public news responses use
`Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=60`; Next.js requests
revalidate after 60 seconds. Consequently a newly published or archived article may take up to
the active cache interval to appear or disappear. Admin editorial responses remain
`private, no-store`, and public 404 responses are not assigned the successful-response cache
header.

Public pages render validated structured blocks when present, fall back to legacy plain text with
preserved paragraphs, and show localized publication dates. There are no author pages, public draft
previews, search, generic category pages, comments, reactions, view counters, related-content
recommendations, RSS, sitemap, scheduled publication, analytics, or public mutations. This remains
an incremental delivery slice, not a production-readiness claim.

### Controlled news categories and Live Updates

Every article has exactly one primary category from a controlled bilingual lookup:
`ANNOUNCEMENTS`, `SECURITY_ADVISORIES`, `COMMUNITY_UPDATES`, `FOUNDATION_ACTIVITIES`,
`LIVE_UPDATES`, or `NEWS`. `NEWS`/`Labarai` is the compatibility category used by the additive
migration to backfill existing articles without inventing a narrower classification. Category
codes and slugs are system-controlled; this release has no category create, rename, deactivate,
delete, or management interface, no secondary categories, and no free-form tags.

Editorial create and draft-edit requests require an active `categoryCode`. Category changes are
allowed only while an article is `DRAFT`; existing ownership, review, approval, history, and
optimistic-concurrency rules remain unchanged. Live Updates use the same article model and
approval lifecycle, with shorter limits (title 140, summary 280, body 1,000 characters) and do
not bypass editorial review. The authenticated read-only category endpoint is
`GET /api/admin/news/categories`; the admin list accepts a controlled `category` code filter.

The public list accepts an optional controlled slug, for example
`GET /api/public/news?category=live-updates`. Public article responses include only the localized
category name and public slug—never the category UUID or staff identity. Published visibility
also requires an active category. Dedicated feeds are available at `/news/live` and
`/en/news/live`; generic category routes remain deferred. The homepages request at most five Live
Updates and omit the block when none qualify, while ordinary recent news excludes Live Updates
to prevent duplication.

Relative timestamps update locally once per minute and retain an accessible exact timestamp.
These `LIVE_UPDATES` category articles remain historical ordinary articles under the normal
editorial review lifecycle. They are not migrated into, deleted by, or used as the engine for the
dedicated live coverage described below.

### Dedicated live coverage

New live blogs use the separate `LiveEvent` / `LiveUpdate` models and the admin routes
`/admin/live` and `/admin/live/:eventId`. Creating an event produces a draft. Authorized live
publishers explicitly start it, after which authorized editors and moderators may publish concise
updates directly without the ordinary article review lifecycle. The lifecycle is deliberately
narrow: `DRAFT -> ACTIVE`, `ACTIVE -> CLOSED`, `CLOSED -> ACTIVE`, and `ACTIVE|CLOSED -> ARCHIVED`.
Draft archival and all other transitions are rejected. Created, started, ended, reopened, and
archived operations are recorded with their actor and time.

The API allocates update sequence numbers by atomically incrementing an event-local PostgreSQL
counter inside the update transaction. Each submission also carries a client UUID idempotency key.
Updates may be pinned in place, corrected with an immutable previous-version revision and reason,
or withdrawn with actor, time, and reason while retaining a public placeholder. Live images must
reference active Phase 3 `NewsroomMedia`; private incident evidence has no relation or conversion
path into live coverage.

Public indexes are `/live` and `/en/live`; detail routes are `/live/:slug` and
`/en/live/:slug`. English pages require an English event title and include only updates with an
English body (plus neutral withdrawn placeholders); Hausa text is never presented as English and
there is no automatic translation. Active coverage is shown before ended coverage. Ended coverage
remains public, rejects new updates, and may be explicitly reopened.

Initial detail loading is capped at 20 newest updates and older updates load with a
`beforeSequence` cursor. The incremental endpoint is
`GET /api/public/live/:slug/updates?afterSequence=N&changedAfter=ISO_TIMESTAMP`; it is capped at 20
by default and 50 maximum. The browser polls it every 12 seconds while visible. New updates insert
normally near the top; a scrolled reader instead sees a new-update indicator, so their position is
not moved. Corrections, withdrawals, and pin changes are also returned by the narrow incremental
endpoint. Stable `#update-N` anchors and copy-link controls provide event-local sharing.

Live metadata uses locale-specific canonicals and only advertises an English alternate when the
event has English content. Featured newsroom media supplies the Open Graph image. `LiveBlogPosting`
structured data is deferred until a complete and independently validated schema can be emitted;
no fabricated structured data is published. This phase has polling rather than SSE/WebSockets and
does not include push notifications, scheduling, comments, analytics, or Redis.

### Structured security advisories

Articles in the controlled `SECURITY_ADVISORIES` category now require a one-to-one structured
advisory record. Hausa remains canonical: severity, affected-area guidance, and recommended
actions in Hausa are mandatory. English advisory fields must be complete together and are
permitted only when the article has a complete English translation. Other news categories cannot
store advisory data. Changing a draft away from the security-advisory category removes the
structured row atomically when the draft is saved.

Severity is one of `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, or `INFORMATIONAL`; these labels are
editorial classifications, not CVSS calculations. References are optional, limited to ten,
HTTPS-only, free of embedded credentials, and deduplicated by normalized URL. The feature does
not fetch, crawl, preview, score, or otherwise trust external destinations.

Published advisories are available at `/news/security` and `/en/news/security`; the public API
uses the existing `GET /api/public/news` endpoint with
`category=security-advisories` and an optional allowlisted `severity` filter. The admin list uses
the same category/severity pairing. Public detail pages show the localized structured fields and
safe external reference links, but never expose article IDs, staff identities, workflow history,
or internal security data. Homepage advisory blocks are capped at three, and ordinary recent
news excludes both Live Updates and security advisories to prevent duplication. The normal
60-second public cache remains in effect; no polling, push delivery, automatic threat feed,
scanner, alert subscription, geotargeting, taxonomy engine, CVSS calculator, or AI-generated
advice is included.

## Newsroom media and article publishing

Newsroom media is a separate bounded context from private citizen incident evidence. Editorial
images use `NewsroomMedia`, the `newsroom/images/` object namespace, and—during filesystem
development—the separate `NEWSROOM_MEDIA_FILESYSTEM_ROOT`. No incident attachment is copied,
linked, or promoted automatically. S3-compatible deployments reuse the configured private object
provider while retaining the distinct namespace; public pages receive only controlled API media
URLs, never storage keys or filesystem paths.

The first media slice accepts JPEG, PNG, and WebP images up to 8 MiB. The API checks the claimed
MIME type, filename extension, file signature, and dimensions (maximum 12,000 × 12,000), computes
a SHA-256 exact-duplicate hint, and requires Hausa alt text. English alt text/caption are optional;
caption, credit, source, provenance, and internal rights notes are stored separately. The library
is `/admin/media`; API routes are `POST/GET /api/admin/media`,
`GET/PATCH /api/admin/media/:mediaId`, `GET /api/admin/media/:mediaId/content`, and
`PATCH /api/admin/media/:mediaId/archive`. Editors may upload/use, moderators may also edit
metadata, and administrators may archive. Media referenced by a published article cannot be
archived.

Draft articles can select one featured image, an optional separate social image, inline images,
and an ordered gallery through `PATCH /api/admin/news/:articleId/media`. Story revisions retain
legacy text and may also hold controlled JSON blocks for paragraphs, level-two/three headings,
bold/italic spans, lists, quotes, HTTP(S) links, image references, and dividers. Arbitrary HTML is
never accepted or rendered, and old revisions remain readable through the plain-text fallback.
Unpublished preview uses the authenticated `/admin/news/:articleId/preview` route and forwards the
HttpOnly staff session only on the server; it does not create a public preview token or discoverable
draft URL.

Administrators can manage featured/breaking presentation flags and append immutable bilingual
correction notes. Breaking is permitted only on published stories. Corrections update the explicit
public update timestamp without silently overwriting their audit record. Public article responses
include only active featured/gallery media projections, validated story blocks, correction notes,
publication/update timestamps, and presentation flags. `GET /api/public/news/media/:mediaId`
streams an active image only when it is referenced by a published story. Featured media supplies
the Open Graph image; the source-controlled site image is the fallback. Hausa and English article
canonicals and available-language alternates remain distinct.

This is intentionally a small editorial library, not a digital-asset-management or video system.
There is no image transformation pipeline, virus scanner, automatic rights decision, permanent
media deletion, incident-evidence conversion, push delivery, or Muryanmu
rebrand in this phase.

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

`INCIDENT_STORAGE_DRIVER` accepts `filesystem` for local development or `s3` for a private
S3-compatible service. Filesystem storage is rejected in production unless the explicit
`ALLOW_PRODUCTION_FILESYSTEM_STORAGE=true` emergency override is supplied. S3 mode requires the
endpoint, region, bucket, access key, secret key, and path-style setting shown in `.env.example`.
The adapter never creates public ACLs or public URLs. `INCIDENT_STORAGE_FILESYSTEM_ROOT` selects
the local private root (for example `.var/incident-uploads`); never place it beneath
`apps/web/public`.

`NEWSROOM_MEDIA_FILESYSTEM_ROOT` selects a different local root (for example
`.var/newsroom-media`) for publishable editorial images. It must also remain outside
`apps/web/public`; browser delivery always goes through the API public-reference checks.

`TRUST_PROXY` defaults to `false`. Use `loopback` only when the actual deployment has one trusted
proxy on the same host/network boundary. Incorrect trust can make IP-based abuse controls unsafe.
`DEPENDENCY_CHECK_TIMEOUT_MS` and `STORAGE_OPERATION_TIMEOUT_MS` bound dependency probes and
private-object operations without imposing a global request timeout on legitimate multipart
uploads. `SHUTDOWN_GRACE_PERIOD_MS` bounds connection draining after readiness is removed.
Production requires HTTPS `WEB_ORIGIN`, a Secure staff cookie, and HTTPS public web/API URLs. Set
`DEPLOYMENT_ENV=production` for deployed web builds; the default `local` profile allows an ordinary
local `next build` without confusing Next.js's build-time `NODE_ENV=production` with a real
deployment.

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
pnpm db:migrate:deploy # apply checked-in migrations in staging/production
pnpm db:status       # compare checked-in migrations with a live database
pnpm db:verify       # verify PostgreSQL reachability and PostGIS activation
pnpm env:check       # validate API and web environment configuration
pnpm release:smoke   # smoke-test running API/web URLs
pnpm staff:create-first-admin --email local.admin@garkuwa.test --display-name "Local Administrator"
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

`GET /api/health` remains the compatibility process-health route.
`GET /api/health/live` reports process liveness without checking dependencies.
`GET /api/health/ready` checks PostgreSQL and the selected private object store with a bounded
timeout and returns 503 during bootstrap, dependency failure, or shutdown. Orchestrators should
restart on liveness failure and route traffic only on readiness success.

## Staff email identity requirement

Staff authentication trims email addresses and normalizes them to lowercase before insertion and
lookup. It does not rely only on PostgreSQL's ordinary case-sensitive unique constraint.

## Verification boundaries

CI starts PostgreSQL/PostGIS, generates Prisma Client, applies checked-in migrations through
`migrate deploy`, verifies migration status, validates development and production-like environment
profiles, and then runs formatting, linting, type-checking, tests, builds, and patch hygiene.

## Current scope

This repository contains application bootstrapping, bilingual public pages, environment
validation, database connectivity, local tooling, foundational tests, anonymous incident
submission, secure staff authentication, controlled incident workflow, and restricted audited
contact access and internal staff notes described above. It intentionally does **not** implement
public tracking, reporter accounts, bulk contact reveal, contact export, arbitrary incident editing or
deletion, unrestricted media types, device-location
access, maps, production category management, editorial analytics,
public object storage, notifications, Redis, queues, outbox events, Kubernetes,
microservices, or Kafka. The platform remains an incremental foundation and is not a claim of
production readiness.

## Release operations and known deployment limits

Operational documentation is source controlled:

- [deployment architecture](docs/operations/deployment.md)
- [release runbook](docs/operations/release-runbook.md)
- [rollback runbook](docs/operations/rollback-runbook.md)
- [backup and restore](docs/operations/backup-and-restore.md)
- [data-retention decisions](docs/operations/data-retention.md)
- [development dependency advisories](docs/operations/development-dependency-advisories.md)
- [production checklist](docs/operations/production-checklist.md)

All current rate limiters and duplicate windows are in-memory and per API process. This includes
public incident submission (5 per IP per 15 minutes plus a 5-minute duplicate window), staff login
(5 per IP per 15 minutes plus account lockout), contact access (10 per staff member per 15
minutes), staff notes (30 per staff member per 15 minutes), attachment review (20 per staff member
per 15 minutes), and editorial/institutional mutations (60 per staff member per 15 minutes).
Restarting a process clears these maps, and multiple replicas do not share them. Horizontal
deployment therefore requires an approved shared store and reviewed client-IP proxy topology.

The API emits request IDs and production JSON request logs containing only method, path (without
query), status, and duration. It does not intentionally log bodies, query values, cookies,
authorization headers, incident content, contacts, notes, filenames, object keys, hashes, storage
paths, encryption keys, or database credentials. Operators must keep platform/proxy logging rules
equally restrictive.

No production Dockerfile is currently committed, so container-image build validation is not
claimed. `.dockerignore` is ready for a future reviewed image definition and excludes secrets,
private evidence, dumps, logs, dependencies, and build output.

CI gates the deployable dependency graph with `pnpm audit --prod`. The full development graph must
also be reviewed for every release; development-only advisories are not automatically forced
across incompatible major versions because doing so can invalidate lint/test tooling.

## Institutional content management

Five institutional pages are controlled by the platform: `ABOUT`, `FAQ`, `HELP`, `CONTACT`,
and `SAFETY_GUIDANCE`. Staff cannot create, rename, or delete pages. Hausa is canonical and
required; English is public only when the entire revision is complete.

Public routes are `/about`, `/faq`, `/help`, `/contact`, and `/safety`, with English equivalents
under `/en`. The former Hausa routes `/game-da-mu`, `/taimako`, and `/tuntube-mu` remain as
permanent redirects. Successful public page API responses use
`public, max-age=60, s-maxage=300, stale-while-revalidate=60`, so publication can take up to the
bounded cache interval to appear.

Authenticated management uses `/admin/content` and `/admin/content/:pageKey`. API routes are:

- `GET /api/admin/institutional-pages`
- `GET /api/admin/institutional-pages/:pageKey`
- `PATCH /api/admin/institutional-pages/:pageKey/draft`
- `PATCH /api/admin/institutional-pages/:pageKey/status`
- `GET /api/admin/institutional-pages/:pageKey/revisions`
- `GET /api/admin/institutional-pages/:pageKey/history`
- `GET /api/public/institutional-pages/:pageKey?lang=ha|en`

`SUPER_ADMIN`, `ADMIN`, `EDITOR`, and `MODERATOR` may view. Editors and administrators may save
immutable drafts and submit them for review; moderators and administrators may return content
with a reason; only `SUPER_ADMIN` and `ADMIN` may publish. Mutations require a staff session,
trusted Origin, strict JSON, a per-instance staff mutation limit, and `expectedUpdatedAt`
optimistic concurrency. The previous published revision stays public during editing and review.

The additive migration imports the existing source-controlled About, FAQ, Help, Contact, and
general safety wording. This is not a general CMS: it has no arbitrary pages, deletion, rich
text, HTML, images, scheduling, unpublish, rollback, analytics, autosave, browser draft storage,
or collaborative editing.
