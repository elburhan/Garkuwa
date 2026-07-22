import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  defaultLocale,
  getEquivalentPublicPath,
  getMessages,
  getPublicPath,
  isSupportedLocale,
  publicRoutePairs,
  resolveLocaleSegment,
  supportedLocales,
} from '../src/i18n';

describe('web localization foundation', () => {
  it('defines only Hausa and English as supported locales', () => {
    expect(supportedLocales).toEqual(['ha', 'en']);
    expect(isSupportedLocale('fr')).toBe(false);
  });

  it('makes Hausa the true default', () => {
    expect(defaultLocale).toBe('ha');
  });

  it('renders only english in [locale] and rejects unsupported locale segments', () => {
    expect(resolveLocaleSegment('ha')).toEqual({ kind: 'not-found' });
    expect(resolveLocaleSegment('en')).toEqual({ kind: 'render', locale: 'en' });
    expect(resolveLocaleSegment('fr')).toEqual({ kind: 'not-found' });
  });

  it('maps every static public page to its Hausa and English equivalent', () => {
    expect(publicRoutePairs).toEqual({
      home: { ha: '/', en: '/en' },
      faq: { ha: '/faq', en: '/en/faq' },
      help: { ha: '/taimako', en: '/en/help' },
      about: { ha: '/game-da-mu', en: '/en/about' },
      contact: { ha: '/tuntube-mu', en: '/en/contact' },
      reportIncident: { ha: '/rahoton-lamari', en: '/en/report-incident' },
    });

    for (const page of Object.keys(publicRoutePairs) as (keyof typeof publicRoutePairs)[]) {
      expect(getEquivalentPublicPath(getPublicPath('ha', page), 'en')).toBe(
        getPublicPath('en', page),
      );
      expect(getEquivalentPublicPath(getPublicPath('en', page), 'ha')).toBe(
        getPublicPath('ha', page),
      );
    }
  });

  it('never emits /ha and preserves admin paths', () => {
    const generatedPaths = Object.values(publicRoutePairs).flatMap(({ ha, en }) => [ha, en]);

    expect(generatedPaths.some((path) => String(path).startsWith('/ha'))).toBe(false);
    expect(getEquivalentPublicPath('/admin', 'en')).toBe('/admin');
    expect(getEquivalentPublicPath('/admin/settings', 'ha')).toBe('/admin/settings');
  });

  it('keeps canonical Hausa and English report routes as an explicit pair', () => {
    expect(getPublicPath('ha', 'reportIncident')).toBe('/rahoton-lamari');
    expect(getPublicPath('en', 'reportIncident')).toBe('/en/report-incident');
    expect(getEquivalentPublicPath('/rahoton-lamari', 'en')).toBe('/en/report-incident');
    expect(getEquivalentPublicPath('/en/report-incident', 'ha')).toBe('/rahoton-lamari');
  });

  it('keeps /ha redirect separate and blocks nested /ha locale pages', () => {
    const legacyHaPage = readFileSync(resolve(process.cwd(), 'src/app/ha/page.tsx'), 'utf8');
    const localeLayout = readFileSync(
      resolve(process.cwd(), 'src/app/[locale]/layout.tsx'),
      'utf8',
    );

    expect(legacyHaPage).toContain("redirect('/');");
    expect(localeLayout).toContain('.filter((locale) => locale !== defaultLocale)');
    expect(localeLayout).toContain("if (resolution.kind !== 'render')");
    expect(getEquivalentPublicPath('/ha/report-incident', 'en')).toBe('/en');
  });

  it('uses a documented canonical-home fallback for unknown public paths', () => {
    expect(getEquivalentPublicPath('/not-yet-mapped', 'ha')).toBe('/');
    expect(getEquivalentPublicPath('/not-yet-mapped', 'en')).toBe('/en');
  });

  it('loads the required navigation labels in both languages', () => {
    const ha = getMessages('ha');
    const en = getMessages('en');

    expect([
      ha.navigation.home,
      ha.navigation.faq,
      ha.navigation.help,
      ha.navigation.about,
      ha.navigation.contact,
      ha.navigation.reportIncident,
    ]).toEqual([
      'Shafin farko',
      'Tambayoyin da ake yawan yi',
      'Taimako',
      'Game da mu',
      'Tuntuɓe mu',
      'Bayar da Rahoto',
    ]);
    expect([
      en.navigation.home,
      en.navigation.faq,
      en.navigation.help,
      en.navigation.about,
      en.navigation.contact,
      en.navigation.reportIncident,
    ]).toEqual([
      'Home',
      'Frequently asked questions',
      'Help',
      'About us',
      'Contact us',
      'Report an Incident',
    ]);
  });
});
