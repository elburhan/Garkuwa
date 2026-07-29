import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260729082223_add_security_advisory_structure/migration.sql',
  ),
  'utf8',
);

describe('security advisory migration', () => {
  it('is additive and creates only the structured advisory storage', () => {
    expect(migration).toContain('CREATE TYPE "SecurityAdvisorySeverity"');
    expect(migration).toContain('CREATE TABLE "news_security_advisories"');
    expect(migration).toContain('CREATE UNIQUE INDEX "news_security_advisories_article_id_key"');
    expect(migration).toContain('ON DELETE CASCADE');
    expect(migration).not.toMatch(
      /DROP TABLE|DROP COLUMN|DELETE FROM|UPDATE "news_articles"|ALTER TYPE/,
    );
  });
});
