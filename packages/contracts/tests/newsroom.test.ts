import { describe, expect, it } from 'vitest';

import {
  articleMediaUpdateSchema,
  newsroomMediaMetadataSchema,
  publicNewsDetailSchema,
  richArticleBodySchema,
  newsroomArticleListResponseSchema,
  newsroomAssignmentUpdateSchema,
  newsroomWorkflowActionSchema,
  createLiveUpdateSchema,
  liveCorrectionRequestSchema,
  liveIncrementalResponseSchema,
  livePinRequestSchema,
  liveWithdrawalRequestSchema,
} from '../src/index.js';

describe('shared newsroom contracts', () => {
  it('requires a reason when changes are requested', () => {
    expect(() =>
      newsroomWorkflowActionSchema.parse({
        decision: 'REQUEST_CHANGES',
        expectedUpdatedAt: '2026-09-14T10:00:00.000Z',
      }),
    ).toThrow();
  });

  it('rejects unknown assignment fields and stale-version omissions', () => {
    expect(() =>
      newsroomAssignmentUpdateSchema.parse({
        assignedWriterId: null,
        assignedReviewerId: null,
        desk: null,
        dueAt: null,
        priority: 'NORMAL',
        hidden: true,
      }),
    ).toThrow();
  });

  it('validates a narrow newsroom queue response', () => {
    const result = newsroomArticleListResponseSchema.safeParse({
      items: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
    expect(result.success).toBe(true);
  });

  it('validates controlled rich content without accepting arbitrary HTML blocks', () => {
    expect(
      richArticleBodySchema.parse([
        { type: 'heading', level: 2, content: [{ text: 'Muhimmin bayani' }] },
        { type: 'paragraph', content: [{ text: 'Rubutu', bold: true }] },
      ]),
    ).toHaveLength(2);
    expect(() => richArticleBodySchema.parse([{ type: 'html', value: '<script />' }])).toThrow();
  });

  it('requires Hausa media alt text and validates ordered article media references', () => {
    expect(() =>
      newsroomMediaMetadataSchema.parse({ provenance: 'STAFF', altTextHa: '' }),
    ).toThrow();
    expect(
      articleMediaUpdateSchema.parse({
        featuredMediaId: null,
        socialMediaId: null,
        galleryMediaIds: [],
        inlineMediaIds: [],
        expectedUpdatedAt: '2026-09-15T10:00:00.000Z',
      }),
    ).toBeTruthy();
  });

  it('rejects private newsroom media fields from the public article contract', () => {
    const result = publicNewsDetailSchema.safeParse({
      slug: 'labari',
      title: 'Labarin gwaji',
      summary: 'Taƙaitaccen labarin gwaji.',
      body: 'Cikakken labarin gwaji.',
      bodyBlocks: null,
      publishedAt: '2026-09-15T10:00:00.000Z',
      updatedAt: '2026-09-15T10:00:00.000Z',
      isFeatured: false,
      isBreaking: false,
      featuredMedia: null,
      socialMedia: null,
      gallery: [],
      corrections: [],
      hasEnglishTranslation: false,
      category: { slug: 'news', name: 'Labarai' },
      securityAdvisory: null,
      storageKey: 'newsroom/images/private',
    });
    expect(result.success).toBe(false);
  });

  it('shares strict live mutation contracts across API and web', () => {
    expect(
      createLiveUpdateSchema.parse({
        bodyHa: 'Sabuntawa kai tsaye',
        clientSubmissionId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toBeTruthy();
    expect(() =>
      liveCorrectionRequestSchema.parse({
        bodyHa: 'Gyara',
        reason: 'short',
        expectedUpdatedAt: '2026-09-18T10:00:00.000Z',
      }),
    ).toThrow();
    expect(
      livePinRequestSchema.parse({
        isPinned: true,
        expectedUpdatedAt: '2026-09-18T10:00:00.000Z',
      }),
    ).toBeTruthy();
    expect(() =>
      liveWithdrawalRequestSchema.parse({
        reason: 'too short',
        expectedUpdatedAt: '2026-09-18T10:00:00.000Z',
      }),
    ).toThrow();
  });

  it('validates bounded incremental live responses without private media fields', () => {
    const parsed = liveIncrementalResponseSchema.safeParse({
      generatedAt: '2026-09-18T10:00:01.000Z',
      latestSequence: 1,
      hasMore: false,
      updates: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          sequence: 1,
          headline: null,
          body: 'Sabuntawa',
          isPinned: false,
          isWithdrawn: false,
          createdAt: '2026-09-18T10:00:00.000Z',
          updatedAt: '2026-09-18T10:00:00.000Z',
          correctedAt: null,
          media: null,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
