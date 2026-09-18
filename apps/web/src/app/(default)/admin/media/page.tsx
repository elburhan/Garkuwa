import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AdminMediaLibrary } from '@/components/admin/admin-media-library';
import { getMessages, type Locale } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { loadAdminMedia } from '@/lib/admin-media-server-api';

export const metadata: Metadata = { title: 'Rumbun hotunan labarai | Gidauniyar Garkuwa' };

export default async function AdminMediaPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ lang?: string; page?: string; search?: string; status?: string }>;
}>) {
  const parameters = await searchParams;
  const locale: Locale = parameters.lang === 'en' ? 'en' : 'ha';
  const principal = await getAdminPrincipal();
  if (!principal) redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (principal.role === 'ANALYST')
    return (
      <main className="admin-content content-width section-spacing">
        <h1>{getMessages(locale).admin.media.title}</h1>
        <p role="alert">{getMessages(locale).admin.news.accessDenied}</p>
      </main>
    );
  const result = await loadAdminMedia(parameters);
  if (result.kind === 'unauthenticated') redirect(`/admin/login?lang=${locale}&reason=expired`);
  const messages = getMessages(locale).admin.media;
  return (
    <main className="admin-content content-width section-spacing" lang={locale}>
      <nav>
        <Link href={`/admin?lang=${locale}`}>{getMessages(locale).admin.dashboard.title}</Link>
      </nav>
      <h1>{messages.title}</h1>
      <p>{messages.description}</p>
      <form method="get" className="admin-filter-form">
        {locale === 'en' ? <input type="hidden" name="lang" value="en" /> : null}
        <label htmlFor="media-search">{messages.search}</label>
        <input
          id="media-search"
          name="search"
          defaultValue={parameters.search ?? ''}
          maxLength={100}
        />
        <button className="button" type="submit">
          {messages.apply}
        </button>
      </form>
      {result.kind === 'success' ? (
        <AdminMediaLibrary locale={locale} principal={principal} media={result.data} />
      ) : (
        <p role="alert">{messages.failed}</p>
      )}
    </main>
  );
}
