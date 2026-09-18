import { z } from 'zod';

export const newsroomMediaTypes = ['IMAGE', 'VIDEO', 'DOCUMENT'] as const;
export const newsroomMediaStatuses = ['ACTIVE', 'ARCHIVED'] as const;
export const newsroomMediaProvenanceValues = [
  'STAFF',
  'AGENCY',
  'OFFICIAL',
  'CITIZEN_APPROVED',
  'EXTERNAL',
  'OTHER',
] as const;

const safeLinkSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'https:' || protocol === 'http:';
}, 'Only HTTP(S) links are supported.');

export const richTextSpanSchema = z
  .object({
    text: z.string().min(1).max(10_000),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    href: safeLinkSchema.optional(),
  })
  .strict();

const richTextSpansSchema = z.array(richTextSpanSchema).min(1).max(200);
export const richArticleBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), content: richTextSpansSchema }).strict(),
  z
    .object({
      type: z.literal('heading'),
      level: z.union([z.literal(2), z.literal(3)]),
      content: richTextSpansSchema,
    })
    .strict(),
  z.object({ type: z.literal('quote'), content: richTextSpansSchema }).strict(),
  z
    .object({
      type: z.literal('bulletList'),
      items: z.array(z.string().min(1).max(2000)).min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal('numberedList'),
      items: z.array(z.string().min(1).max(2000)).min(1).max(100),
    })
    .strict(),
  z.object({ type: z.literal('image'), mediaId: z.uuid() }).strict(),
  z.object({ type: z.literal('divider') }).strict(),
]);

export const richArticleBodySchema = z.array(richArticleBlockSchema).min(1).max(500);

export const newsroomMediaMetadataSchema = z
  .object({
    altTextHa: z.string().trim().min(5).max(500),
    altTextEn: z.string().trim().min(5).max(500).nullable().optional(),
    captionHa: z.string().trim().max(1000).nullable().optional(),
    captionEn: z.string().trim().max(1000).nullable().optional(),
    credit: z.string().trim().max(300).nullable().optional(),
    source: z.string().trim().max(500).nullable().optional(),
    rightsNotes: z.string().trim().max(2000).nullable().optional(),
    provenance: z.enum(newsroomMediaProvenanceValues),
  })
  .strict();

export const publicMediaSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  altText: z.string(),
  caption: z.string().nullable(),
  credit: z.string().nullable(),
});

export const galleryItemSchema = z.object({
  displayOrder: z.number().int().nonnegative(),
  media: publicMediaSchema,
});

export const articleCorrectionSchema = z.object({
  id: z.uuid(),
  note: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
});

const publicNewsCategorySchema = z.object({ slug: z.string(), name: z.string() }).strict();
const publicNewsContributorSchema = z
  .object({
    displayName: z.string(),
    slug: z.string(),
    contributorRole: z.string(),
  })
  .strict();
const publicAdvisorySeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']);

export const publicNewsItemSchema = z
  .object({
    slug: z.string(),
    title: z.string(),
    summary: z.string(),
    publishedAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    isFeatured: z.boolean(),
    isBreaking: z.boolean(),
    featuredMedia: publicMediaSchema.nullable(),
    hasEnglishTranslation: z.boolean(),
    category: publicNewsCategorySchema,
    contributors: z.array(publicNewsContributorSchema).optional(),
    securityAdvisory: z.object({ severity: publicAdvisorySeveritySchema }).strict().nullable(),
  })
  .strict();

export const publicNewsListSchema = z
  .object({
    generatedAt: z.iso.datetime({ offset: true }),
    items: z.array(publicNewsItemSchema),
    pagination: z
      .object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        totalItems: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const publicNewsDetailSchema = publicNewsItemSchema.extend({
  body: z.string(),
  bodyBlocks: richArticleBodySchema.nullable(),
  socialMedia: publicMediaSchema.nullable(),
  gallery: z.array(galleryItemSchema),
  corrections: z.array(articleCorrectionSchema),
  securityAdvisory: z
    .object({
      severity: publicAdvisorySeveritySchema,
      affectedArea: z.string(),
      recommendedActions: z.string(),
      references: z.array(z.object({ label: z.string(), url: safeLinkSchema }).strict()).max(10),
    })
    .strict()
    .nullable(),
});

export const articleMediaUpdateSchema = z
  .object({
    featuredMediaId: z.uuid().nullable(),
    socialMediaId: z.uuid().nullable(),
    galleryMediaIds: z.array(z.uuid()).max(20),
    inlineMediaIds: z.array(z.uuid()).max(50),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const articlePublishingMetadataSchema = z
  .object({
    isFeatured: z.boolean(),
    isBreaking: z.boolean(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const articleCorrectionInputSchema = z
  .object({
    noteHa: z.string().trim().min(10).max(2000),
    noteEn: z.string().trim().min(10).max(2000).nullable().optional(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type RichArticleBody = z.infer<typeof richArticleBodySchema>;
export type NewsroomMediaMetadata = z.infer<typeof newsroomMediaMetadataSchema>;
export type PublicMedia = z.infer<typeof publicMediaSchema>;
export type ArticleMediaUpdate = z.infer<typeof articleMediaUpdateSchema>;
export type ArticlePublishingMetadata = z.infer<typeof articlePublishingMetadataSchema>;
export type ArticleCorrectionInput = z.infer<typeof articleCorrectionInputSchema>;
export type PublicNewsItem = z.infer<typeof publicNewsItemSchema>;
export type PublicNewsList = z.infer<typeof publicNewsListSchema>;
export type PublicNewsDetail = z.infer<typeof publicNewsDetailSchema>;
