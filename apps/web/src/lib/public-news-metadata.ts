import type { Metadata } from 'next';

import { getMessages, getPublicPath, type Locale } from '@/i18n';

import type { PublicNewsDetail } from './public-news-api';
import { webEnvironment } from './env';
import { publicNewsMediaUrl } from './public-news-api';

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

export function createSecurityAdvisoryListMetadata(locale: Locale): Metadata {
  const messages = getMessages(locale);
  const copy = messages.publicNews;
  const localizedPath = getPublicPath(locale, 'securityNews');
  return {
    title: `${copy.securityAdvisories} | ${messages.common.siteName}`,
    description: copy.securityAdvisoriesIntroduction,
    alternates: {
      canonical: absoluteUrl(localizedPath),
      languages: {
        ha: absoluteUrl(getPublicPath('ha', 'securityNews')),
        en: absoluteUrl(getPublicPath('en', 'securityNews')),
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
  const localizedPath = locale === 'en' && article.hasEnglishTranslation ? enPath : haPath;
  const socialImage = article.socialMedia ?? article.featuredMedia;
  return {
    title: `${article.title} | ${getMessages(locale).common.siteName}`,
    description: article.summary,
    alternates: {
      canonical: absoluteUrl(localizedPath),
      languages: {
        ha: absoluteUrl(haPath),
        ...(article.hasEnglishTranslation ? { en: absoluteUrl(enPath) } : {}),
      },
    },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.summary,
      url: absoluteUrl(localizedPath),
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: socialImage
        ? [
            {
              url: publicNewsMediaUrl(socialImage.url),
              width: socialImage.width,
              height: socialImage.height,
              alt: socialImage.altText,
            },
          ]
        : [
            {
              url: absoluteUrl('/default-news-social.svg'),
              width: 1200,
              height: 630,
              alt: getMessages(locale).common.siteName,
            },
          ],
    },
  };
}
