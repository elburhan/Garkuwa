import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { PublicShell } from '@/components/public/public-shell';
import { getMessages, resolveLocaleSegment, supportedLocales } from '@/i18n';
import { webEnvironment } from '@/lib/env';

import '../globals.css';

type LocaleLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const resolution = resolveLocaleSegment((await params).locale);

  if (resolution.kind !== 'render') {
    return {};
  }

  const messages = getMessages(resolution.locale);

  return {
    metadataBase: new URL(webEnvironment.NEXT_PUBLIC_APP_URL),
    title: messages.common.siteName,
    description: messages.metadata.homeDescription,
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const resolution = resolveLocaleSegment((await params).locale);

  if (resolution.kind === 'not-found') {
    notFound();
  }

  if (resolution.kind === 'redirect') {
    redirect(resolution.destination);
  }

  return (
    <html lang={resolution.locale}>
      <body>
        <PublicShell locale={resolution.locale}>{children}</PublicShell>
      </body>
    </html>
  );
}
