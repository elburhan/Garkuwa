import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('live coverage completion migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20260918100000_complete_live_coverage/migration.sql'),
    'utf8',
  );

  it('adds concurrency, revision, withdrawal, media, and operation structures additively', () => {
    expect(sql).toContain('ADD COLUMN "next_sequence"');
    expect(sql).toContain('CREATE TABLE "live_update_revisions"');
    expect(sql).toContain('CREATE TABLE "live_event_operations"');
    expect(sql).toContain('ADD COLUMN "client_submission_id"');
    expect(sql).toContain('ADD COLUMN "media_id"');
    expect(sql).toContain('ADD COLUMN "withdrawal_reason"');
    expect(sql).not.toMatch(/DROP TABLE|DROP TYPE|TRUNCATE|DELETE FROM/i);
    expect(sql).not.toMatch(/incident_attachments|incident_contacts/);
  });
});
