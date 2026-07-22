import type { ReactNode } from 'react';

import { PublicShell } from '@/components/public/public-shell';

export default function HausaPublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <PublicShell locale="ha">{children}</PublicShell>;
}
