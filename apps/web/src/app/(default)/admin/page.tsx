import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminLanding } from '@/components/admin/admin-landing';
import type { Locale } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { webEnvironment } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Sashen gudanarwa | Gidauniyar Garkuwa',
};

export default async function AdminLandingPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ lang?: string }> }>) {
  const parameters = await searchParams;
  const locale: Locale = parameters.lang === 'en' ? 'en' : 'ha';
  const principal = await getAdminPrincipal();
  if (!principal) redirect(`/admin/login?lang=${locale}&reason=expired`);
  return (
    <AdminLanding
      locale={locale}
      principal={principal}
      apiBaseUrl={webEnvironment.NEXT_PUBLIC_API_BASE_URL}
    />
  );
}
