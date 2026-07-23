import Link from 'next/link';

import { getMessages, type Locale } from '@/i18n';
import type { AdminPrincipal } from '@/lib/admin-auth';

import { AdminLogoutButton } from './admin-logout-button';

export function AdminLanding({
  locale,
  principal,
  apiBaseUrl,
}: Readonly<{ locale: Locale; principal: AdminPrincipal; apiBaseUrl: string }>) {
  const messages = getMessages(locale).admin;
  return (
    <main className="admin-landing content-width section-spacing" lang={locale}>
      <div className="admin-landing-header">
        <div>
          <p className="eyebrow">{messages.landing.eyebrow}</p>
          <h1>{messages.landing.title}</h1>
        </div>
        <nav aria-label={messages.login.languageLabel} className="admin-language-links">
          <Link href="/admin?lang=ha" aria-current={locale === 'ha' ? 'page' : undefined}>
            Hausa
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/admin?lang=en" aria-current={locale === 'en' ? 'page' : undefined}>
            English
          </Link>
        </nav>
      </div>
      <section className="admin-welcome-card">
        <h2>{messages.landing.welcome.replace('{name}', principal.name)}</h2>
        <p>{messages.landing.description}</p>
        <dl>
          <div>
            <dt>{messages.landing.email}</dt>
            <dd>{principal.email}</dd>
          </div>
          <div>
            <dt>{messages.landing.role}</dt>
            <dd>{principal.role.replaceAll('_', ' ')}</dd>
          </div>
        </dl>
        <AdminLogoutButton locale={locale} apiBaseUrl={apiBaseUrl} />
      </section>
    </main>
  );
}
