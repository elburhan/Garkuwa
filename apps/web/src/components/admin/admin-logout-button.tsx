'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { getMessages, type Locale } from '@/i18n';

export function AdminLogoutButton({
  locale,
  apiBaseUrl,
}: Readonly<{ locale: Locale; apiBaseUrl: string }>) {
  const messages = getMessages(locale).admin.landing;
  const router = useRouter();
  const inProgress = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const logout = async () => {
    if (inProgress.current) return;
    inProgress.current = true;
    setIsSubmitting(true);
    setError(undefined);
    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/auth/staff/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        setError(messages.logoutError);
        return;
      }
      router.replace(`/admin/login?lang=${locale}`);
      router.refresh();
    } catch {
      setError(messages.logoutError);
    } finally {
      inProgress.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <button
        className="button button-secondary"
        type="button"
        onClick={logout}
        disabled={isSubmitting}
      >
        {isSubmitting ? messages.loggingOut : messages.logout}
      </button>
      {error ? (
        <p role="alert" className="admin-auth-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
