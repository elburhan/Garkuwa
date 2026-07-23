import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminLoginForm } from '@/components/admin/admin-login-form';
import type { Locale } from '@/i18n';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { webEnvironment } from '@/lib/env';

export const metadata: Metadata = { title: 'Staff sign in | Garkuwa Foundation' };

export default async function AdminLoginPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ lang?: string; reason?: string }> }>) {
  const principal = await getAdminPrincipal();
  const parameters = await searchParams;
  const locale: Locale = parameters.lang === 'en' ? 'en' : 'ha';
  if (principal) redirect(`/admin?lang=${locale}`);

  return (
    <AdminLoginForm
      locale={locale}
      apiBaseUrl={webEnvironment.NEXT_PUBLIC_API_BASE_URL}
      sessionExpired={parameters.reason === 'expired'}
    />
  );
}
