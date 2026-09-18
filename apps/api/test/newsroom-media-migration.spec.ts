import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('newsroom media migration', () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      'prisma/migrations/20260915100000_add_newsroom_media_publishing/migration.sql',
    ),
    'utf8',
  );

  it('adds only the Phase 3 newsroom media and publishing structures', () => {
    expect(sql).toContain('CREATE TABLE "newsroom_media"');
    expect(sql).toContain('CREATE TABLE "news_article_media"');
    expect(sql).toContain('CREATE TABLE "news_article_corrections"');
    expect(sql).toContain('ADD COLUMN "body_blocks_ha" JSONB');
    expect(sql).not.toMatch(/DROP TABLE|DROP TYPE|TRUNCATE|DELETE FROM/i);
    expect(sql).not.toMatch(/incident_attachments|incident_contacts/);
  });
});
