import type { ReactNode } from 'react';

import { getMessages, type Locale } from '@/i18n';

import { PublicFooter } from './public-footer';
import { PublicHeader } from './public-header';
import { TrustNotice } from './trust-notice';

export function PublicShell({
  children,
  locale,
}: Readonly<{ children: ReactNode; locale: Locale }>) {
  const messages = getMessages(locale);

  return (
    <>
      <a className="skip-link" href="#main-content">
        {messages.accessibility.skipToContent}
      </a>
      <PublicHeader locale={locale} />
      <main id="main-content" className="public-main" tabIndex={-1}>
        {children}
      </main>
      <TrustNotice locale={locale} />
      <PublicFooter locale={locale} />
    </>
  );
}
