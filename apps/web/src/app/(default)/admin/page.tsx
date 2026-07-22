import type { Metadata } from 'next';

import { getMessages } from '@/i18n';

export const metadata: Metadata = {
  title: 'Sashen gudanarwa | Gidauniyar Garkuwa',
};

export default function AdminPlaceholderPage() {
  const messages = getMessages('ha');

  return (
    <main className="content-width page-content section-spacing" lang="ha">
      <h1>{messages.admin.title}</h1>
      <p>{messages.admin.placeholder}</p>
    </main>
  );
}
