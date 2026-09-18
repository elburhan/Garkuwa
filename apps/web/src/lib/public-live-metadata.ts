import type { Metadata } from 'next';

import { webEnvironment } from './env';
import { loadPublicLiveEvent } from './public-live-api';
import { publicNewsMediaUrl } from './public-news-api';

const app = webEnvironment.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
export function liveIndexMetadata(locale: 'ha' | 'en'): Metadata {
  const english = locale === 'en';
  return {
    title: english
      ? 'Live coverage | Garkuwa Foundation'
      : 'Rahotanni kai tsaye | Gidauniyar Garkuwa',
    description: english
      ? 'Verified updates from developing events.'
      : 'Sabbin bayanai da aka tantance daga abubuwan da ke faruwa.',
    alternates: {
      canonical: `${app}${english ? '/en' : ''}/live`,
      languages: { ha: `${app}/live`, en: `${app}/en/live` },
    },
  };
}

export async function liveDetailMetadata(slug: string, locale: 'ha' | 'en'): Promise<Metadata> {
  const result = await loadPublicLiveEvent(slug, locale);
  if (result.kind !== 'success') return {};
  const event = result.data;
  const canonical = `${app}${locale === 'en' ? '/en' : ''}/live/${slug}`;
  const languages: Record<string, string> = { ha: `${app}/live/${slug}` };
  if (event.hasEnglishTranslation) languages.en = `${app}/en/live/${slug}`;
  const image = event.featuredMedia
    ? publicNewsMediaUrl(event.featuredMedia.url)
    : `${app}/default-news-social.svg`;
  return {
    title: event.title,
    description: event.summary ?? event.title,
    alternates: { canonical, languages },
    openGraph: {
      type: 'article',
      title: event.title,
      description: event.summary ?? event.title,
      url: canonical,
      images: [{ url: image }],
    },
  };
}
