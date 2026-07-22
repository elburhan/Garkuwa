import enMessages from '../messages/en.json';
import haMessages from '../messages/ha.json';

export const supportedLocales = ['ha', 'en'] as const;
export type Locale = (typeof supportedLocales)[number];

export const defaultLocale = 'ha' satisfies Locale;

export type Messages = typeof haMessages;

const messages: Record<Locale, Messages> = {
  ha: haMessages,
  en: enMessages,
};

export function isSupportedLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}

export function getPublicHomePath(locale: Locale): '/' | '/en' {
  return locale === defaultLocale ? '/' : '/en';
}

export const requiredMessageNamespaces = [
  'common',
  'navigation',
  'homepage',
  'faq',
  'help',
  'about',
  'contact',
  'footer',
  'accessibility',
  'trust',
  'featureStatus',
  'metadata',
  'public',
] as const satisfies readonly (keyof Messages)[];
