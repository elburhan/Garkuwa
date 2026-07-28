'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import type { AdminPrincipal } from '@/lib/admin-auth';
import type { NewsArticle } from '@/lib/admin-news-api';
import { transitionNewsArticle, type NewsDecision } from '@/lib/admin-news-mutations';

function allowed(article: NewsArticle, principal: AdminPrincipal): NewsDecision[] {
  const admin = principal.role === 'SUPER_ADMIN' || principal.role === 'ADMIN';
  if (article.status === 'DRAFT' && (admin || article.author.id === principal.id)) {
    return ['SUBMIT_FOR_REVIEW'];
  }
  if (article.status === 'IN_REVIEW') {
    return [
      ...(admin || principal.role === 'MODERATOR' ? ['RETURN_TO_DRAFT' as const] : []),
      ...(admin ? ['APPROVE_PUBLICATION' as const] : []),
    ];
  }
  return article.status === 'PUBLISHED' && admin ? ['ARCHIVE'] : [];
}

export function AdminNewsWorkflow({
  locale,
  article,
  principal,
}: Readonly<{ locale: Locale; article: NewsArticle; principal: AdminPrincipal }>) {
  const messages = getMessages(locale).admin.news;
  const router = useRouter();
  const decisions = allowed(article, principal);
  const [decision, setDecision] = useState<NewsDecision | ''>(decisions[0] ?? '');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  if (decisions.length === 0) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision || !confirmed || (decision === 'RETURN_TO_DRAFT' && reason.trim().length < 10)) {
      setNotice(messages.validationError);
      return;
    }
    setPending(true);
    const result = await transitionNewsArticle(
      article.id,
      decision,
      article.updatedAt,
      reason.trim() || undefined,
    );
    setPending(false);
    setNotice(
      result.kind === 'success'
        ? messages.actionSucceeded
        : result.kind === 'conflict'
          ? messages.conflict
          : messages.actionFailed,
    );
    if (result.kind === 'success') router.refresh();
  }

  return (
    <form onSubmit={submit} className="admin-news-workflow">
      <fieldset disabled={pending}>
        <legend>{messages.editorialHistory}</legend>
        <label htmlFor="news-decision">{messages.status[article.status]}</label>
        <select
          id="news-decision"
          value={decision}
          onChange={(event) => setDecision(event.target.value as NewsDecision)}
        >
          {decisions.map((value) => (
            <option key={value} value={value}>
              {messages.decision[value]}
            </option>
          ))}
        </select>
        {decision === 'RETURN_TO_DRAFT' ? (
          <>
            <label htmlFor="news-review-reason">{messages.reviewReason}</label>
            <textarea
              id="news-review-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={1000}
              required
            />
          </>
        ) : null}
        {decision === 'APPROVE_PUBLICATION' ? (
          <p className="admin-read-only-notice">{messages.notPublicWarning}</p>
        ) : null}
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          {messages.confirmAction}
        </label>
        <button type="submit" className="button">
          {pending ? messages.saving : decision ? messages.decision[decision] : messages.saveDraft}
        </button>
      </fieldset>
      <p role="status" aria-live="polite">
        {notice}
      </p>
    </form>
  );
}
