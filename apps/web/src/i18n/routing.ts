import { defaultLocale, isSupportedLocale } from '@garkuwa/i18n';
import type { Locale } from '@garkuwa/i18n';

export const publicRoutePairs = {
  home: { ha: '/', en: '/en' },
  news: { ha: '/news', en: '/en/news' },
  liveNews: { ha: '/news/live', en: '/en/news/live' },
  securityNews: { ha: '/news/security', en: '/en/news/security' },
  faq: { ha: '/faq', en: '/en/faq' },
  help: { ha: '/taimako', en: '/en/help' },
  about: { ha: '/game-da-mu', en: '/en/about' },
  contact: { ha: '/tuntube-mu', en: '/en/contact' },
  reportIncident: { ha: '/rahoton-lamari', en: '/en/report-incident' },
} as const;

export type PublicPageKey = keyof typeof publicRoutePairs;
export type PublicPath = (typeof publicRoutePairs)[PublicPageKey][Locale];

export type LocaleSegmentResolution = { kind: 'render'; locale: 'en' } | { kind: 'not-found' };

export function resolveLocaleSegment(segment: string): LocaleSegmentResolution {
  if (!isSupportedLocale(segment) || segment === defaultLocale) {
    return { kind: 'not-found' };
  }

  return { kind: 'render', locale: segment };
}

export function getPublicPath(locale: Locale, page: PublicPageKey): PublicPath {
  return publicRoutePairs[page][locale];
}

export function getEquivalentPublicPath(pathname: string, targetLocale: Locale): string {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return pathname;
  }

  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  const haNewsDetail = normalizedPath.match(/^\/news\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  const enNewsDetail = normalizedPath.match(/^\/en\/news\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  const newsSlug = haNewsDetail?.[1] ?? enNewsDetail?.[1];
  if (newsSlug) {
    return targetLocale === 'ha' ? `/news/${newsSlug}` : `/en/news/${newsSlug}`;
  }
  const pair = Object.values(publicRoutePairs).find(
    ({ ha, en }) => ha === normalizedPath || en === normalizedPath,
  );

  // Unknown public paths fall back to the selected language's canonical homepage.
  return pair?.[targetLocale] ?? publicRoutePairs.home[targetLocale];
}
