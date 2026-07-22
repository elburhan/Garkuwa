import type { Metadata } from 'next';

import { getMessages, getPublicPath, type Locale, type PublicPageKey } from '@/i18n';

import { webEnvironment } from './env';

const metadataKeys = {
  home: { title: 'homeTitle', description: 'homeDescription' },
  faq: { title: 'faqTitle', description: 'faqDescription' },
  help: { title: 'helpTitle', description: 'helpDescription' },
  about: { title: 'aboutTitle', description: 'aboutDescription' },
  contact: { title: 'contactTitle', description: 'contactDescription' },
} as const satisfies Record<
  PublicPageKey,
  {
    title: keyof ReturnType<typeof getMessages>['metadata'];
    description: keyof ReturnType<typeof getMessages>['metadata'];
  }
>;

export function createPublicMetadata(locale: Locale, page: PublicPageKey): Metadata {
  const messages = getMessages(locale);
  const keys = metadataKeys[page];
  const localizedPath = getPublicPath(locale, page);
  const haPath = getPublicPath('ha', page);
  const enPath = getPublicPath('en', page);
  const title = messages.metadata[keys.title];
  const absoluteUrl = (path: string) => new URL(path, webEnvironment.NEXT_PUBLIC_APP_URL).href;

  return {
    title: page === 'home' ? title : `${title} | ${messages.common.siteName}`,
    description: messages.metadata[keys.description],
    alternates: {
      canonical: absoluteUrl(localizedPath),
      languages: {
        ha: absoluteUrl(haPath),
        en: absoluteUrl(enPath),
      },
    },
  };
}
