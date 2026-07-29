import { z } from 'zod';

import type { Locale } from '@/i18n';

import { webEnvironment } from './env';

export const institutionalPageKeys = [
  'ABOUT',
  'FAQ',
  'HELP',
  'CONTACT',
  'SAFETY_GUIDANCE',
] as const;
export type InstitutionalPageKey = (typeof institutionalPageKeys)[number];

const responseSchema = z.object({
  key: z.enum(institutionalPageKeys),
  title: z.string(),
  summary: z.string().nullable(),
  sections: z.array(
    z.object({
      sectionKey: z.string(),
      heading: z.string(),
      body: z.string(),
    }),
  ),
  publishedAt: z.iso.datetime({ offset: true }),
  hasEnglishTranslation: z.boolean(),
});
export type PublicInstitutionalPage = z.infer<typeof responseSchema>;
export type PublicInstitutionalPageResult =
  | { kind: 'success'; data: PublicInstitutionalPage }
  | { kind: 'not-found' }
  | { kind: 'unavailable' };

export async function loadPublicInstitutionalPage(
  pageKey: InstitutionalPageKey,
  locale: Locale,
  fetcher: typeof fetch = fetch,
): Promise<PublicInstitutionalPageResult> {
  const base = webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '');
  try {
    const response = await fetcher(`${base}/public/institutional-pages/${pageKey}?lang=${locale}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (response.status === 404) return { kind: 'not-found' };
    if (!response.ok) throw new Error('Institutional content unavailable.');
    return { kind: 'success', data: responseSchema.parse(await response.json()) };
  } catch {
    return { kind: 'unavailable' };
  }
}
