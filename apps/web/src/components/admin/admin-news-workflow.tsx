'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import type { AdminPrincipal } from '@/lib/admin-auth';
import type { NewsArticle } from '@/lib/admin-news-api';
import { transitionNewsArticle, type NewsDecision } from '@/lib/admin-news-mutations';

function allowed(article: NewsArticle, principal: AdminPrincipal): NewsDecision[] {
  const admin = principal.role === 'SUPER_ADMIN' || principal.role === 'ADMIN';
  const reviewer = admin || principal.role === 'MODERATOR';
  if (
    (article.status === 'DRAFT' || article.status === 'CHANGES_REQUESTED') &&
    (admin || article.author.id === principal.id)
  ) {
    return admin ? ['PUBLISH', 'SUBMIT_FOR_REVIEW'] : ['SUBMIT_FOR_REVIEW'];
  }
  if (article.status === 'IN_REVIEW') {
    return reviewer ? ['REQUEST_CHANGES', ...(admin ? ['PUBLISH' as const] : [])] : [];
  }
  if (article.status === 'READY_TO_PUBLISH' && admin) return ['PUBLISH'];
  if (article.status === 'PUBLISHED' && admin) return ['UNPUBLISH', 'ARCHIVE'];
  return article.status === 'UNPUBLISHED' && admin ? ['ARCHIVE'] : [];
}

export function AdminNewsWorkflow({
  locale,
  article,
  principal,
}: Readonly<{ locale: Locale; article: NewsArticle; principal: AdminPrincipal }>) {
  const messages = getMessages(locale).admin.news;
  const router = useRouter();
  const decisions = allowed(article, principal);
  const [decision, setDecision] = useState<NewsDecision | ''>('');
  const [reason, setReason] = useState('');
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  if (decisions.length === 0) return null;

  async function submitAction(nextDecision: NewsDecision) {
    if (nextDecision === 'REQUEST_CHANGES' && reason.trim().length < 10) {
      setNotice(messages.validationError);
      return;
    }
    setPending(true);
    const result = await transitionNewsArticle(
      article.id,
      nextDecision,
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

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (decision) void submitAction(decision);
  }

  return (
    <form onSubmit={submit} className="admin-news-workflow">
      <fieldset disabled={pending}>
        {decisions.map((value) => (
          <button
            key={value}
            type="button"
            className={value === 'PUBLISH' ? 'button button-primary' : 'button'}
            onClick={() => {
              setDecision(value);
              if (value === 'PUBLISH' && !window.confirm(messages.publishQuestion)) return;
              if (value === 'REQUEST_CHANGES') {
                setDecision(value);
                setReturnDialogOpen(true);
              } else void submitAction(value);
            }}
          >
            {pending ? messages.saving : messages.decision[value]}
          </button>
        ))}
      </fieldset>
      {returnDialogOpen ? (
        <dialog open aria-labelledby="news-review-reason-title">
          <form
            method="dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void submitAction('REQUEST_CHANGES');
              setReturnDialogOpen(false);
            }}
          >
            <h2 id="news-review-reason-title">{messages.returnQuestion}</h2>
            <label htmlFor="news-review-reason">{messages.reviewReason}</label>
            <textarea
              id="news-review-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={1000}
              required
            />
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setReturnDialogOpen(false)}
            >
              {messages.cancel}
            </button>
            <button type="submit" className="button">
              {messages.returnStory}
            </button>
          </form>
        </dialog>
      ) : null}
      <p role="status" aria-live="polite">
        {notice}
      </p>
    </form>
  );
}
