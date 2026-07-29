import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260729053746_add_news_categories_and_live_updates/migration.sql',
  ),
  'utf8',
);

describe('news category migration', () => {
  it('seeds exactly the six controlled codes in deterministic order', () => {
    const codes = [
      'ANNOUNCEMENTS',
      'SECURITY_ADVISORIES',
      'COMMUNITY_UPDATES',
      'FOUNDATION_ACTIVITIES',
      'LIVE_UPDATES',
      'NEWS',
    ];
    for (const code of codes) expect(migration).toContain(`'${code}'`);
    expect(migration.match(/\('10000000-0000-4000-8000-00000000000[1-6]'/g)).toHaveLength(6);
  });

  it('adds nullable, backfills NEWS, verifies, then enforces the relation', () => {
    const add = migration.indexOf('ADD COLUMN "category_id" UUID;');
    const backfill = migration.indexOf('UPDATE "news_articles"');
    const verify = migration.indexOf('left uncategorized articles');
    const required = migration.indexOf('ALTER COLUMN "category_id" SET NOT NULL');
    expect(add).toBeGreaterThan(-1);
    expect(add).toBeLessThan(backfill);
    expect(backfill).toBeLessThan(verify);
    expect(verify).toBeLessThan(required);
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM "news_articles"/);
  });
});
