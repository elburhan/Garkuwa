import Link from 'next/link';

import { getMessages, type Locale } from '@/i18n';

export function AdminAccessDenied({ locale }: Readonly<{ locale: Locale }>) {
  const messages = getMessages(locale).admin.incidents.accessDenied;
  return (
    <main className="admin-content content-width section-spacing" lang={locale}>
      <section className="admin-message-card" aria-labelledby="access-denied-title">
        <p className="eyebrow">403</p>
        <h1 id="access-denied-title">{messages.title}</h1>
        <p>{messages.description}</p>
        <Link className="button button-secondary" href={`/admin?lang=${locale}`}>
          {messages.back}
        </Link>
      </section>
    </main>
  );
}
