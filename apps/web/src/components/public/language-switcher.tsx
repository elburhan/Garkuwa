'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getEquivalentPublicPath, type Locale } from '@/i18n';

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
      <span aria-hidden="true">/</span>
      <Link
        href={getEquivalentPublicPath(pathname, 'en')}
        hrefLang="en"
        lang="en"
        aria-current={locale === 'en' ? 'page' : undefined}
      >
        {enLabel}
      </Link>
    </nav>
  );
}
