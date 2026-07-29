import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { AdminInstitutionalContentEditor } from '@/components/admin/admin-institutional-content-editor';
import { getMessages, type Locale } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import {
  loadInstitutionalHistory,
  loadInstitutionalPage,
  loadInstitutionalRevisions,
} from '@/lib/admin-institutional-content-api';

export const metadata: Metadata = {
  title: 'Gyaran shafin hukuma | Gidauniyar Garkuwa',
};
const viewerRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'MODERATOR']);

export default async function AdminContentEditorPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ pageKey: string }>;
  searchParams: Promise<{ lang?: string }>;
}>) {
  const [{ pageKey }, query] = await Promise.all([params, searchParams]);
  const locale: Locale = query.lang === 'en' ? 'en' : 'ha';
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
  const [detail, revisions, history] = await Promise.all([
    loadInstitutionalPage(pageKey),
    loadInstitutionalRevisions(pageKey),
    loadInstitutionalHistory(pageKey),
  ]);
  if (detail.kind === 'not-found') notFound();
  if (detail.kind !== 'success' || revisions.kind !== 'success' || history.kind !== 'success') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{copy.title}</h1>
        <p role="alert">{copy.unavailable}</p>
      </main>
    );
  }
  return (
    <AdminInstitutionalContentEditor
      locale={locale}
      page={detail.data.page}
      revisions={revisions.data}
      history={history.data}
    />
  );
}
