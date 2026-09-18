'use client';

import { newsroomDesks, newsroomPriorities } from '@garkuwa/contracts/newsroom';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import type { NewsArticle, NewsEligibleAssignees } from '@/lib/admin-news-api';
import { assignNewsArticle } from '@/lib/admin-news-mutations';

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 16);
}

export function AdminNewsAssignment({
  locale,
  article,
  assignees,
}: Readonly<{
  locale: Locale;
  article: NewsArticle;
  assignees: NewsEligibleAssignees['items'];
}>) {
  const messages = getMessages(locale).admin.news;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dueAt = String(form.get('dueAt') ?? '');
    setPending(true);
    const result = await assignNewsArticle(article.id, {
      assignedWriterId: String(form.get('writer') ?? '') || null,
      assignedReviewerId: String(form.get('reviewer') ?? '') || null,
      desk: (String(form.get('desk') ?? '') || null) as (typeof newsroomDesks)[number] | null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      priority: String(form.get('priority') ?? 'NORMAL') as (typeof newsroomPriorities)[number],
      reason: String(form.get('reason') ?? '').trim() || undefined,
      expectedUpdatedAt: article.updatedAt,
    });
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
    <form className="admin-news-workflow" onSubmit={submit}>
      <fieldset disabled={pending}>
        <legend>{messages.assignment}</legend>
        <label htmlFor="news-writer">{messages.writer}</label>
        <select id="news-writer" name="writer" defaultValue={article.assignedWriter?.id ?? ''}>
          <option value="">—</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </select>
        <label htmlFor="news-reviewer">{messages.reviewer}</label>
        <select
          id="news-reviewer"
          name="reviewer"
          defaultValue={article.assignedReviewer?.id ?? ''}
        >
          <option value="">—</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </select>
        <label htmlFor="news-desk">{messages.desk}</label>
        <select id="news-desk" name="desk" defaultValue={article.desk ?? ''}>
          <option value="">—</option>
          {newsroomDesks.map((desk) => (
            <option key={desk} value={desk}>
              {desk}
            </option>
          ))}
        </select>
        <label htmlFor="news-priority">{messages.priority}</label>
        <select id="news-priority" name="priority" defaultValue={article.priority ?? 'NORMAL'}>
          {newsroomPriorities.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
        <label htmlFor="news-due-at">{messages.dueDate}</label>
        <input
          id="news-due-at"
          name="dueAt"
          type="datetime-local"
          defaultValue={toDateTimeLocal(article.dueAt)}
        />
        <label htmlFor="news-assignment-reason">{messages.reviewReason}</label>
        <textarea id="news-assignment-reason" name="reason" minLength={10} maxLength={1000} />
        <button className="button" type="submit">
          {pending ? messages.saving : messages.saveDraft}
        </button>
      </fieldset>
      <p role="status" aria-live="polite">
        {notice}
      </p>
    </form>
  );
}
