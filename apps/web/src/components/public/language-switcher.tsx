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
