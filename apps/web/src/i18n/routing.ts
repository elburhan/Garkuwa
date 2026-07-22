import { defaultLocale, isSupportedLocale } from '@garkuwa/i18n';
import type { Locale } from '@garkuwa/i18n';

export const publicRoutePairs = {
  home: { ha: '/', en: '/en' },
  faq: { ha: '/faq', en: '/en/faq' },
  help: { ha: '/taimako', en: '/en/help' },
  about: { ha: '/game-da-mu', en: '/en/about' },
  contact: { ha: '/tuntube-mu', en: '/en/contact' },
} as const;

export type PublicPageKey = keyof typeof publicRoutePairs;
export type PublicPath = (typeof publicRoutePairs)[PublicPageKey][Locale];

export type LocaleSegmentResolution =
  { kind: 'render'; locale: 'en' } | { kind: 'redirect'; destination: '/' } | { kind: 'not-found' };

export function resolveLocaleSegment(segment: string): LocaleSegmentResolution {
  if (!isSupportedLocale(segment)) {
    return { kind: 'not-found' };
  }

  if (segment === defaultLocale) {
    return { kind: 'redirect', destination: '/' };
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
  const pair = Object.values(publicRoutePairs).find(
    ({ ha, en }) => ha === normalizedPath || en === normalizedPath,
  );

  // Unknown public paths fall back to the selected language's canonical homepage.
  return pair?.[targetLocale] ?? publicRoutePairs.home[targetLocale];
}
