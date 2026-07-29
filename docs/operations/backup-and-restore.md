# Backup and restore runbook

Database rows and private incident objects form one operational data set. A database-only backup
can leave attachment metadata without matching evidence; an object-only backup can leave
unreferenced private data. Backup schedules, retention periods, encryption, access, recovery
objectives, and legal holds require institutional approval.

## Database backup

Run from a controlled host with credentials supplied through the secret manager:

```sh
pg_dump --format=custom --no-owner --no-acl --file=garkuwa.dump "$DATABASE_URL"
```

Encrypt the artifact using the approved backup system, store it outside the application host, and
record its checksum and PostgreSQL/PostGIS versions. Never commit dumps.

## Private object storage

Enable provider-native versioning and encrypted backups where approved. Keep the bucket private,
retain object keys exactly, and include the bucket configuration in recovery documentation.
Do not copy incident objects to a public bucket or ordinary shared drive.

## Restore rehearsal

1. Create an isolated recovery environment with no public traffic.
2. Restore into an empty database:

   ```sh
   pg_restore --exit-on-error --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" garkuwa.dump
   ```

3. Restore the corresponding private object snapshot.
4. Supply the correct historical `CONTACT_DATA_ENCRYPTION_KEY`; losing it makes encrypted reporter
   contact values unrecoverable. Never print it during verification.
5. Run `pnpm db:verify`, `pnpm db:status`, API readiness, and a non-sensitive attachment
   metadata/content authorization check.
6. Confirm counts and referential integrity without printing incident descriptions, contacts,
   notes, filenames, hashes, paths, or credentials.
7. Destroy the rehearsal environment according to the approved retention process.

Production restoration requires an incident commander and explicit approval. Do not use
`prisma db push`, reset the database, or overwrite a live database as a rehearsal.
