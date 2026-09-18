import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { NewsArticleStatus, StaffRole } from '../src/generated/prisma/enums.js';
import type { StaffPrincipal } from '../src/modules/auth/auth.types.js';
import {
  createNewsArticleSchema,
  newsArticleCorrectionSchema,
  newsArticleMediaSchema,
  newsArticlePublishingMetadataSchema,
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

  it('requires structured advisory data only for the security category', () => {
    expect(() =>
      createNewsArticleSchema.parse({ ...content, categoryCode: 'SECURITY_ADVISORIES' }),
    ).toThrow();
    const advisory = {
      severity: 'HIGH' as const,
      affectedAreaHa: 'Masu amfani da tsohon tsarin da abin ya shafa.',
      recommendedActionsHa:
        'A sabunta tsarin, a tabbatar da tushen saƙo, sannan a bi umarnin tsaro.',
      affectedAreaEn: null,
      recommendedActionsEn: null,
      references: [{ label: 'Official security guidance', url: 'https://example.org/security' }],
    };
    const parsed = createNewsArticleSchema.parse({
      ...content,
      categoryCode: 'SECURITY_ADVISORIES',
      securityAdvisory: advisory,
    });
    expect(parsed.securityAdvisory).toMatchObject({
      severity: 'HIGH',
      affectedAreaHa: advisory.affectedAreaHa,
    });
    expect(() =>
      createNewsArticleSchema.parse({ ...content, securityAdvisory: advisory }),
    ).toThrow();
  });

  it('rejects unsafe, credential-bearing, duplicate, and partial-English advisory references', () => {
    const base = {
      ...content,
      categoryCode: 'SECURITY_ADVISORIES' as const,
      securityAdvisory: {
        severity: 'MEDIUM' as const,
        affectedAreaHa: 'Bangaren sabis da wannan sanarwar take shafa.',
        recommendedActionsHa:
          'A bi matakan kariya da aka bayyana, sannan a tabbatar da adireshin shafin.',
        affectedAreaEn: null,
        recommendedActionsEn: null,
        references: [{ label: 'Guidance', url: 'http://example.org/guidance' }],
      },
    };
    expect(() => createNewsArticleSchema.parse(base)).toThrow();
    expect(() =>
      createNewsArticleSchema.parse({
        ...base,
        securityAdvisory: {
          ...base.securityAdvisory,
          references: [{ label: 'Guidance', url: 'https://user:secret@example.org/guidance' }],
        },
      }),
    ).toThrow();
    expect(() =>
      createNewsArticleSchema.parse({
        ...base,
        securityAdvisory: {
          ...base.securityAdvisory,
          references: [
            { label: 'One', url: 'https://example.org/guidance#first' },
            { label: 'Two', url: 'https://example.org/guidance#second' },
          ],
        },
      }),
    ).toThrow();
    expect(() =>
      createNewsArticleSchema.parse({
        ...base,
        titleEn: 'English advisory title',
        summaryEn: 'A complete English advisory summary for public review.',
        bodyEn: `A complete English advisory body. ${'Content '.repeat(15)}`,
        securityAdvisory: {
          ...base.securityAdvisory,
          references: [],
        },
      }),
    ).toThrow();
  });

  it('requires a bounded return reason and expected timestamp', () => {
    expect(() =>
      newsArticleDecisionSchema.parse({
        decision: 'REQUEST_CHANGES',
        expectedUpdatedAt: new Date().toISOString(),
      }),
    ).toThrow();
    expect(
      newsArticleDecisionSchema.parse({
        decision: 'REQUEST_CHANGES',
        reason: '  Please correct the named sourcing paragraph.  ',
        expectedUpdatedAt: '2026-07-29T10:00:00.000Z',
      }).reason,
    ).toBe('Please correct the named sourcing paragraph.');
  });

  it('validates article media, publishing flags and auditable corrections strictly', () => {
    const expectedUpdatedAt = '2026-09-15T10:00:00.000Z';
    expect(
      newsArticleMediaSchema.parse({
        featuredMediaId: null,
        socialMediaId: null,
        galleryMediaIds: [],
        inlineMediaIds: [],
        expectedUpdatedAt,
      }),
    ).toBeTruthy();
    expect(() =>
      newsArticlePublishingMetadataSchema.parse({
        isFeatured: true,
        isBreaking: false,
        expectedUpdatedAt,
        hidden: true,
      }),
    ).toThrow();
    expect(
      newsArticleCorrectionSchema.parse({
        noteHa: '  An gyara muhimmin lokacin da aka ambata.  ',
        noteEn: null,
        expectedUpdatedAt,
      }).noteHa,
    ).toBe('An gyara muhimmin lokacin da aka ambata.');
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
    expect(() =>
      assertCanEditDraft('author-id', NewsArticleStatus.DRAFT, actor(StaffRole.EDITOR)),
    ).not.toThrow();
    expect(() =>
      assertCanEditDraft('other-id', NewsArticleStatus.DRAFT, actor(StaffRole.EDITOR)),
    ).toThrow(ForbiddenException);
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
        'REQUEST_CHANGES',
        actor(StaffRole.MODERATOR),
      ),
    ).toBe(NewsArticleStatus.CHANGES_REQUESTED);
    expect(
      assertEditorialDecisionAllowed(
        NewsArticleStatus.UNPUBLISHED,
        'author-id',
        'MARK_READY_TO_PUBLISH',
        actor(StaffRole.MODERATOR),
      ),
    ).toBe(NewsArticleStatus.READY_TO_PUBLISH);
    expect(() =>
      assertEditorialDecisionAllowed(
        NewsArticleStatus.READY_TO_PUBLISH,
        'author-id',
        'PUBLISH',
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
