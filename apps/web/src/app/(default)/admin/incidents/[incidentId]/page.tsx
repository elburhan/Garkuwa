import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { AdminAccessDenied } from '@/components/admin/admin-access-denied';
import { AdminIncidentDetailView } from '@/components/admin/admin-incident-detail';
import type { Locale } from '@/i18n';
import { getMessages } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import {
  incidentViewerRoles,
  loadContactAccessHistory,
  loadAdminIncidentDetail,
  loadEligibleAssignees,
  loadStaffNotes,
} from '@/lib/admin-incidents-api';

export const metadata: Metadata = { title: 'Cikakken rahoton lamari | Gidauniyar Garkuwa' };

export default async function AdminIncidentDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ incidentId: string }>;
  searchParams: Promise<{ lang?: string }>;
}>) {
  const [{ incidentId }, parameters] = await Promise.all([params, searchParams]);
  const locale: Locale = parameters.lang === 'en' ? 'en' : 'ha';
  const principal = await getAdminPrincipal();
  if (!principal) redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (!incidentViewerRoles.has(principal.role)) return <AdminAccessDenied locale={locale} />;

  const result = await loadAdminIncidentDetail(incidentId);
  if (result.kind === 'unauthenticated') redirect(`/admin/login?lang=${locale}&reason=expired`);
  if (result.kind === 'forbidden') return <AdminAccessDenied locale={locale} />;
  if (result.kind === 'not-found') notFound();
  if (result.kind !== 'success') {
    return (
      <main className="admin-content content-width section-spacing" lang={locale}>
        <h1>{getMessages(locale).admin.incidents.detail.title}</h1>
        <p className="admin-message-card" role="alert">
          {getMessages(locale).admin.incidents.detail.error}
        </p>
      </main>
    );
  }
  const mayAssign = principal.role === 'SUPER_ADMIN' || principal.role === 'ADMIN';
  const [assignees, contactHistory, staffNotes] = await Promise.all([
    mayAssign ? loadEligibleAssignees() : Promise.resolve(null),
    mayAssign ? loadContactAccessHistory(incidentId) : Promise.resolve(null),
    loadStaffNotes(incidentId),
  ]);
  if (
    assignees?.kind === 'unauthenticated' ||
    contactHistory?.kind === 'unauthenticated' ||
    staffNotes.kind === 'unauthenticated'
  ) {
    redirect(`/admin/login?lang=${locale}&reason=expired`);
  }
  return (
    <AdminIncidentDetailView
      locale={locale}
      incident={result.data.incident}
      role={principal.role as 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'ANALYST'}
      principalId={principal.id}
      eligibleAssignees={assignees?.kind === 'success' ? assignees.data.users : []}
      contactAccessHistory={
        contactHistory?.kind === 'success' ? contactHistory.data.items : undefined
      }
      staffNotes={staffNotes.kind === 'success' ? staffNotes.data.items : []}
    />
  );
}
