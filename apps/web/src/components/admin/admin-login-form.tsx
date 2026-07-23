'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { getMessages, type Locale } from '@/i18n';

export function AdminLoginForm({
  locale,
  apiBaseUrl,
  sessionExpired,
}: Readonly<{ locale: Locale; apiBaseUrl: string; sessionExpired: boolean }>) {
  const messages = getMessages(locale).admin.login;
  const router = useRouter();
  const submitting = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    setError(undefined);
    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/auth/staff/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? messages.tooManyAttempts : messages.invalidCredentials);
        return;
      }
      setPassword('');
      router.replace(`/admin?lang=${locale}`);
      router.refresh();
    } catch {
      setError(messages.networkError);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <main className="admin-auth-page" lang={locale}>
      <section className="admin-auth-card" aria-labelledby="admin-login-title">
        <div className="admin-language-links" aria-label={messages.languageLabel}>
          <Link href="/admin/login?lang=ha" aria-current={locale === 'ha' ? 'page' : undefined}>
            {messages.hausa}
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/admin/login?lang=en" aria-current={locale === 'en' ? 'page' : undefined}>
            {messages.english}
          </Link>
        </div>
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1 id="admin-login-title">{messages.title}</h1>
        <p className="admin-auth-description">{messages.description}</p>
        {sessionExpired ? <p className="admin-auth-notice">{messages.sessionExpired}</p> : null}
        {error ? (
          <p className="admin-auth-error" role="alert" tabIndex={-1}>
            {error}
          </p>
        ) : null}
        <form onSubmit={submit} className="admin-login-form">
          <label htmlFor="admin-email">{messages.email}</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            maxLength={320}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="admin-password">{messages.password}</label>
          <input
            id="admin-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            minLength={12}
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            className="password-visibility-button"
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? messages.hidePassword : messages.showPassword}
          </button>
          <button
            className="button button-primary admin-submit-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? messages.signingIn : messages.signIn}
          </button>
        </form>
        <p className="admin-security-notice">{messages.securityNotice}</p>
      </section>
    </main>
  );
}
