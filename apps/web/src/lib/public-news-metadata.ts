import type { Metadata } from 'next';

import { getMessages, getPublicPath, type Locale } from '@/i18n';

import type { PublicNewsDetail } from './public-news-api';
import { webEnvironment } from './env';

const absoluteUrl = (path: string) => new URL(path, webEnvironment.NEXT_PUBLIC_APP_URL).href;

export function createPublicNewsListMetadata(locale: Locale): Metadata {
  const copy = getMessages(locale).publicNews;
  const localizedPath = getPublicPath(locale, 'news');
  return {
    title: `${copy.listMetadataTitle} | ${getMessages(locale).common.siteName}`,
    description: copy.listMetadataDescription,
    alternates: {
      canonical: absoluteUrl(localizedPath),
      languages: {
        ha: absoluteUrl(getPublicPath('ha', 'news')),
        en: absoluteUrl(getPublicPath('en', 'news')),
      },
    },
  };
}

export function createPublicNewsArticleMetadata(
  locale: Locale,
  article: PublicNewsDetail,
): Metadata {
  const haPath = `/news/${article.slug}`;
  const enPath = `/en/news/${article.slug}`;
  return {
    title: `${article.title} | ${getMessages(locale).common.siteName}`,
    description: article.summary,
    alternates: {
      canonical: absoluteUrl(haPath),
      languages: {
        ha: absoluteUrl(haPath),
        ...(article.hasEnglishTranslation ? { en: absoluteUrl(enPath) } : {}),
      },
    },
  };
}
