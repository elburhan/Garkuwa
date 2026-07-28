import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminNewsList } from '@/components/admin/admin-news-list';
import type { Locale } from '@/i18n';
import { getMessages } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { loadNewsArticles, type AdminNewsSearchParams } from '@/lib/admin-news-api';

export const metadata: Metadata = { title: 'Gudanar da labarai | Gidauniyar Garkuwa' };
const viewerRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'MODERATOR']);

export default async function AdminNewsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<AdminNewsSearchParams> }>) {
  const parameters = await searchParams;
  const locale: Locale = parameters.lang === 'en' ? 'en' : 'ha';
  const principal = await getAdminPrincipal();
  if (!principal) redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (!viewerRoles.has(principal.role)) {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{getMessages(locale).admin.news.management}</h1>
        <p role="alert" className="admin-message-card">
          {getMessages(locale).admin.news.accessDenied}
        </p>
      </main>
    );
  }
  const result = await loadNewsArticles(parameters);
  if (result.kind === 'unauthenticated') redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (result.kind !== 'success') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{getMessages(locale).admin.news.articles}</h1>
        <p role="alert" className="admin-message-card">
          {getMessages(locale).admin.news.articleUnavailable}
        </p>
      </main>
    );
  }
  return (
    <AdminNewsList
      locale={locale}
      principal={principal}
      news={result.data}
      parameters={parameters}
    />
  );
}
