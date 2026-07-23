import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminAccessDenied } from '@/components/admin/admin-access-denied';
import { AdminIncidentQueue } from '@/components/admin/admin-incident-queue';
import type { Locale } from '@/i18n';
import { getMessages } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import {
  incidentViewerRoles,
  loadAdminIncidentQueue,
  type AdminIncidentSearchParams,
} from '@/lib/admin-incidents-api';
import { webEnvironment } from '@/lib/env';
import { loadIncidentCategories } from '@/lib/public-api';

export const metadata: Metadata = { title: 'Jerin rahotannin lamura | Gidauniyar Garkuwa' };

export default async function AdminIncidentsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<AdminIncidentSearchParams> }>) {
  const parameters = await searchParams;
  const locale: Locale = parameters.lang === 'en' ? 'en' : 'ha';
  const principal = await getAdminPrincipal();
  if (!principal) redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (!incidentViewerRoles.has(principal.role)) return <AdminAccessDenied locale={locale} />;

  const [result, categories] = await Promise.all([
    loadAdminIncidentQueue(parameters),
    loadIncidentCategories(webEnvironment.NEXT_PUBLIC_API_BASE_URL).catch(() => []),
  ]);
  if (result.kind === 'unauthenticated') redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (result.kind === 'forbidden') return <AdminAccessDenied locale={locale} />;
  if (result.kind !== 'success') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{getMessages(locale).admin.incidents.queue.title}</h1>
        <p className="admin-message-card" role="alert">
          {getMessages(locale).admin.incidents.queue.error}
        </p>
      </main>
    );
  }
  return (
    <AdminIncidentQueue
      locale={locale}
      queue={result.data}
      parameters={parameters}
      categories={categories}
    />
  );
}
