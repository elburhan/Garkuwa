import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260729092544_add_institutional_content_management/migration.sql',
  ),
  'utf8',
);

describe('institutional content migration', () => {
  it('is additive and seeds exactly the five controlled keys', () => {
    expect(migration).toContain(
      "CREATE TYPE \"InstitutionalPageKey\" AS ENUM ('ABOUT', 'FAQ', 'HELP', 'CONTACT', 'SAFETY_GUIDANCE')",
    );
    for (const key of ['ABOUT', 'FAQ', 'HELP', 'CONTACT', 'SAFETY_GUIDANCE']) {
      expect(migration).toContain(`'${key}', 'PUBLISHED'`);
    }
    expect(migration.match(/'PUBLISHED', CURRENT_TIMESTAMP\)/g)).toHaveLength(5);
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM|ALTER TYPE/);
    expect(migration).not.toMatch(/incidents|incident_contacts|news_articles/);
  });

  it('records initial revisions and immutable publication history', () => {
    expect(migration).toContain('INSERT INTO "institutional_page_revisions"');
    expect(migration).toContain('INSERT INTO "institutional_page_workflow_history"');
    expect(migration).toContain('Game da Dandalin Garkuwa');
    expect(migration).toContain('Frequently asked questions');
    expect(migration).toContain('Bayar da rahoto cikin alhaki');
  });
});
