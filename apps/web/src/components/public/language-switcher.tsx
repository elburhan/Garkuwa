'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getEquivalentPublicPath, type Locale } from '@/i18n';
import { webEnvironment } from '@/lib/env';

const institutionalKeysByHausaPath: Record<string, string> = {
  '/about': 'ABOUT',
  '/faq': 'FAQ',
  '/help': 'HELP',
  '/contact': 'CONTACT',
  '/safety': 'SAFETY_GUIDANCE',
};

export function LanguageSwitcher({
  locale,
  haLabel,
  enLabel,
  navigationLabel,
}: Readonly<{
  locale: Locale;
  haLabel: string;
  enLabel: string;
  navigationLabel: string;
}>) {
  const pathname = usePathname();
  const isHausaNewsDetail = /^\/news\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname);
  const institutionalKey = locale === 'ha' ? institutionalKeysByHausaPath[pathname] : undefined;
  const [englishAvailability, setEnglishAvailability] = useState<{
    key: string;
    available: boolean;
  } | null>(null);

  useEffect(() => {
    if (!institutionalKey) return;
    const controller = new AbortController();
    const base = webEnvironment.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '');
    void fetch(`${base}/public/institutional-pages/${institutionalKey}?lang=en`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then((response) => setEnglishAvailability({ key: institutionalKey, available: response.ok }))
      .catch(() => setEnglishAvailability({ key: institutionalKey, available: false }));
    return () => controller.abort();
  }, [institutionalKey]);
  const institutionalEnglishAvailable =
    !institutionalKey ||
    (englishAvailability?.key === institutionalKey && englishAvailability.available);

  // Translation availability is article-specific. The article page renders the
  // complete switch; the global shell must not guess an English URL.
  if (locale === 'ha' && isHausaNewsDetail) {
    return (
      <nav className="language-switcher" aria-label={navigationLabel}>
        <span lang="ha" aria-current="page">
          {haLabel}
        </span>
      </nav>
    );
  }

  return (
    <nav className="language-switcher" aria-label={navigationLabel}>
      <Link
        href={getEquivalentPublicPath(pathname, 'ha')}
        hrefLang="ha"
        lang="ha"
        aria-current={locale === 'ha' ? 'page' : undefined}
      >
        {haLabel}
      </Link>
      {institutionalEnglishAvailable ? (
        <>
          <span aria-hidden="true">/</span>
          <Link
            href={getEquivalentPublicPath(pathname, 'en')}
            hrefLang="en"
            lang="en"
            aria-current={locale === 'en' ? 'page' : undefined}
          >
            {enLabel}
          </Link>
        </>
      ) : null}
    </nav>
  );
}
