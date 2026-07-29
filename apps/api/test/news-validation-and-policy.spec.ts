import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { NewsArticleStatus, StaffRole } from '../src/generated/prisma/enums.js';
import type { StaffPrincipal } from '../src/modules/auth/auth.types.js';
import {
  createNewsArticleSchema,
  newsArticleDecisionSchema,
  updateNewsArticleSchema,
} from '../src/modules/news/dto/news.dto.js';
import {
  assertCanEditDraft,
  assertEditorialDecisionAllowed,
} from '../src/modules/news/news-editorial-policy.js';
import { createNewsSlugBase, newsSlugCandidate } from '../src/modules/news/news-slug.js';

const content = {
  categoryCode: 'NEWS' as const,
  titleHa: 'Sanarwar Tsaro ta Gidauniyar Garkuwa',
  summaryHa: 'Wannan taƙaitaccen bayani ne na gwaji domin tabbatar da ingancin tsarin.',
  bodyHa: `Sakin layi na farko yana ɗauke da cikakken bayanin gwaji. ${'Bayani '.repeat(10)}

Sakin layi na biyu ya kasance yadda aka rubuta shi.`,
};
const actor = (role: StaffRole, id = 'author-id'): StaffPrincipal => ({
  id,
  email: 'staff@example.test',
  name: 'Staff',
  role,
});

describe('news validation and editorial policy', () => {
  it('requires Hausa boundaries, trims outer whitespace, and preserves paragraphs', () => {
    const parsed = createNewsArticleSchema.parse({
      ...content,
      bodyHa: `  ${content.bodyHa}  `,
    });
    expect(parsed.bodyHa).toBe(content.bodyHa);
    expect(() =>
      createNewsArticleSchema.parse({ ...content, titleHa: 'Gajere'.slice(0, 4) }),
    ).toThrow();
    expect(() => createNewsArticleSchema.parse({ ...content, summaryHa: 'too short' })).toThrow();
    expect(() => createNewsArticleSchema.parse({ ...content, bodyHa: 'too short' })).toThrow();
  });

  it('enforces English all-or-none and strict mutation fields', () => {
    expect(() => createNewsArticleSchema.parse({ ...content, titleEn: 'English title' })).toThrow();
    expect(
      createNewsArticleSchema.parse({
        ...content,
        titleEn: null,
        summaryEn: null,
        bodyEn: null,
      }),
    ).toMatchObject({ titleEn: null, summaryEn: null, bodyEn: null });
    expect(
      createNewsArticleSchema.parse({
        ...content,
        titleEn: 'English editorial title',
        summaryEn: 'A complete English summary for validation.',
        bodyEn: `A complete English article body. ${'Content '.repeat(15)}`,
      }).titleEn,
    ).toBe('English editorial title');
    expect(() => createNewsArticleSchema.parse({ ...content, status: 'PUBLISHED' })).toThrow();
    expect(() => updateNewsArticleSchema.parse(content)).toThrow();
  });

  it('requires a controlled category and applies the shorter Live Update limits', () => {
    expect(() => createNewsArticleSchema.parse({ ...content, categoryCode: undefined })).toThrow();
    expect(() => createNewsArticleSchema.parse({ ...content, categoryCode: 'OTHER' })).toThrow();
    expect(
      createNewsArticleSchema.parse({
        ...content,
        categoryCode: 'LIVE_UPDATES',
        summaryHa: 'Takaitaccen bayani na lokaci.',
        bodyHa: 'Wannan gajeren bayani ne mai muhimmancin lokaci.',
      }).categoryCode,
    ).toBe('LIVE_UPDATES');
    expect(() =>
      createNewsArticleSchema.parse({
        ...content,
        categoryCode: 'LIVE_UPDATES',
        bodyHa: 'Bayani '.repeat(200),
      }),
    ).toThrow();
    expect(() =>
      createNewsArticleSchema.parse({ ...content, categoryCode: 'NEWS', bodyHa: 'Gajere.' }),
    ).toThrow();
  });

  it('requires a bounded return reason and expected timestamp', () => {
    expect(() =>
      newsArticleDecisionSchema.parse({
        decision: 'RETURN_TO_DRAFT',
        expectedUpdatedAt: new Date().toISOString(),
      }),
    ).toThrow();
    expect(
      newsArticleDecisionSchema.parse({
        decision: 'RETURN_TO_DRAFT',
        reason: '  Please correct the named sourcing paragraph.  ',
        expectedUpdatedAt: '2026-07-29T10:00:00.000Z',
      }).reason,
    ).toBe('Please correct the named sourcing paragraph.');
  });

  it('creates stable URL-safe Hausa slugs with bounded collision suffixes', () => {
    expect(createNewsSlugBase('Sanarwar Ƙasa da Ɗorewar Ƴanci')).toBe(
      'sanarwar-kasa-da-dorewar-yanci',
    );
    expect(createNewsSlugBase('🔥')).toBe('labari');
    const base = createNewsSlugBase('Dogon '.repeat(50));
    expect(base.length).toBeLessThanOrEqual(80);
    expect(newsSlugCandidate(base, 2)).toMatch(/-2$/);
    expect(newsSlugCandidate(base, 2).length).toBeLessThanOrEqual(80);
  });

  it('enforces draft ownership and the exact lifecycle authorization matrix', () => {
    expect(() => assertCanEditDraft('author-id', actor(StaffRole.EDITOR))).not.toThrow();
    expect(() => assertCanEditDraft('other-id', actor(StaffRole.EDITOR))).toThrow(
      ForbiddenException,
    );
    expect(
      assertEditorialDecisionAllowed(
        NewsArticleStatus.DRAFT,
        'author-id',
        'SUBMIT_FOR_REVIEW',
        actor(StaffRole.EDITOR),
      ),
    ).toBe(NewsArticleStatus.IN_REVIEW);
    expect(
      assertEditorialDecisionAllowed(
        NewsArticleStatus.IN_REVIEW,
        'author-id',
        'RETURN_TO_DRAFT',
        actor(StaffRole.MODERATOR),
      ),
    ).toBe(NewsArticleStatus.DRAFT);
    expect(() =>
      assertEditorialDecisionAllowed(
        NewsArticleStatus.IN_REVIEW,
        'author-id',
        'APPROVE_PUBLICATION',
        actor(StaffRole.EDITOR),
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertEditorialDecisionAllowed(
        NewsArticleStatus.ARCHIVED,
        'author-id',
        'SUBMIT_FOR_REVIEW',
        actor(StaffRole.ADMIN),
      ),
    ).toThrow(BadRequestException);
  });
});
