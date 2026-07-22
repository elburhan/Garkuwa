import { describe, expect, it } from 'vitest';

import {
  defaultLocale,
  getMessages,
  getPublicHomePath,
  requiredMessageNamespaces,
  supportedLocales,
} from '../src';

describe('locale configuration', () => {
  it('supports Hausa and English in that order', () => {
    expect(supportedLocales).toEqual(['ha', 'en']);
  });

  it('uses Hausa as the default locale', () => {
    expect(defaultLocale).toBe('ha');
    expect(getPublicHomePath(defaultLocale)).toBe('/');
  });

  it('loads independently authored messages', () => {
    expect(getMessages('ha').homepage.title).toContain('Tabbatattun');
    expect(getMessages('en').homepage.title).toContain('Verified');
    expect(getMessages('ha').homepage.title).not.toBe(getMessages('en').homepage.title);
  });

  it('keeps required top-level namespaces aligned', () => {
    const haNamespaces = Object.keys(getMessages('ha'));
    const enNamespaces = Object.keys(getMessages('en'));

    expect(enNamespaces).toEqual(haNamespaces);
    expect(haNamespaces).toEqual(expect.arrayContaining([...requiredMessageNamespaces]));
  });

  it('provides required navigation labels in both locales', () => {
    for (const locale of supportedLocales) {
      expect(getMessages(locale).navigation).toMatchObject({
        home: expect.any(String),
        faq: expect.any(String),
        help: expect.any(String),
        about: expect.any(String),
        contact: expect.any(String),
      });
    }
  });
});
