import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminInstitutionalContentList } from '@/components/admin/admin-institutional-content-list';
import { getMessages, type Locale } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { loadInstitutionalPages } from '@/lib/admin-institutional-content-api';

export const metadata: Metadata = {
  title: 'Abubuwan shafukan hukuma | Gidauniyar Garkuwa',
};
const viewerRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'MODERATOR']);

export default async function AdminContentPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ lang?: string }> }>) {
  const locale: Locale = (await searchParams).lang === 'en' ? 'en' : 'ha';
  const principal = await getAdminPrincipal();
  if (!principal) redirect(`/admin/login?lang=${locale}&reason=expired`);
  const copy = getMessages(locale).institutionalContent.admin;
  if (!viewerRoles.has(principal.role)) {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{copy.title}</h1>
        <p role="alert">{copy.accessDenied}</p>
      </main>
    );
  }
  const result = await loadInstitutionalPages();
  if (result.kind === 'unauthenticated') redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (result.kind !== 'success') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{copy.title}</h1>
        <p role="alert">{copy.unavailable}</p>
      </main>
    );
  }
  return <AdminInstitutionalContentList locale={locale} pages={result.data} />;
}
