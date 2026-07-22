import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getMessages } from '@/i18n';
import { webEnvironment } from '@/lib/env';

import '../globals.css';

const messages = getMessages('ha');

export const metadata: Metadata = {
  metadataBase: new URL(webEnvironment.NEXT_PUBLIC_APP_URL),
  title: messages.common.siteName,
  description: messages.metadata.homeDescription,
};

export default function DefaultRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ha">
      <body>{children}</body>
    </html>
  );
}
