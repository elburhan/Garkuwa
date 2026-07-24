'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import { submitAttachmentSecurityReview } from '@/lib/admin-attachment-security-review-api';
import type { AttachmentSecurityReviews, IncidentAttachments } from '@/lib/admin-incidents-api';

type Attachment = IncidentAttachments['items'][number];

export function AdminAttachmentSecurityReview({
  locale,
  incidentId,
  attachment,
  role,
  reviews,
}: Readonly<{
  locale: Locale;
  incidentId: string;
  attachment: Attachment;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'ANALYST';
  reviews: AttachmentSecurityReviews['items'];
}>) {
  const router = useRouter();
  const messages = getMessages(locale).admin.incidents.attachments;
  const canReview = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const [decision, setDecision] = useState<'AVAILABLE' | 'REJECTED' | ''>('');
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const reasonValid = reason.trim().length >= 10 && reason.trim().length <= 1000;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    setConflict(false);
    if (!decision || !reasonValid) {
      setNotice(messages.reasonRequired);
      return;
    }
    if (!acknowledged) {
      setNotice(messages.acknowledgementRequired);
      return;
    }

    setPending(true);
    const result = await submitAttachmentSecurityReview(incidentId, attachment.id, {
      decision,
      reason,
      expectedUpdatedAt: attachment.updatedAt,
    });
    setPending(false);
    if (result.kind === 'success') {
      setNotice(messages.success);
      router.refresh();
      return;
    }
    if (result.kind === 'conflict') {
      setConflict(true);
      setNotice(messages.changed);
    } else if (result.kind === 'rate-limit') {
      setNotice(messages.rateLimited);
    } else if (result.kind === 'forbidden') {
      setNotice(messages.notAuthorized);
    } else {
      setNotice(messages.failed);
    }
  }

  return (
    <div className="admin-attachment-review">
      {canReview && attachment.status === 'QUARANTINED' ? (
        <form onSubmit={submit}>
          <fieldset disabled={pending}>
            <legend>{messages.reviewTitle}</legend>
            <p id={`attachment-warning-${attachment.id}`} className="warning-notice">
              {messages.warning}
            </p>
            <label>
              {messages.decision}
              <select
                value={decision}
                onChange={(event) =>
                  setDecision(event.target.value as 'AVAILABLE' | 'REJECTED' | '')
                }
                required
              >
                <option value="">—</option>
                <option value="AVAILABLE">{messages.approve}</option>
                <option value="REJECTED">{messages.reject}</option>
              </select>
            </label>
            <label>
              {messages.reason}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={10}
                maxLength={1000}
                required
                aria-describedby={`attachment-reason-help-${attachment.id} attachment-warning-${attachment.id}`}
                aria-invalid={reason.length > 0 && !reasonValid ? true : undefined}
              />
            </label>
            <p id={`attachment-reason-help-${attachment.id}`} className="field-help">
              {messages.reasonHelp}
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                required
              />
              {messages.acknowledgement}
            </label>
            <button className="button" type="submit">
              {pending ? messages.submitting : messages.submit}
            </button>
          </fieldset>
        </form>
      ) : null}

      <section aria-labelledby={`attachment-review-history-${attachment.id}`}>
        <h4 id={`attachment-review-history-${attachment.id}`}>{messages.history}</h4>
        {reviews.length === 0 ? (
          <p>{messages.noReviews}</p>
        ) : (
          <ol className="admin-status-history">
            {reviews.map((review) => (
              <li key={review.id}>
                <p>
                  <strong>{messages.decision}:</strong>{' '}
                  {review.decision === 'AVAILABLE' ? messages.approved : messages.rejected}
                </p>
                <p>
                  <strong>{messages.reviewSource}:</strong>{' '}
                  {review.reviewSource === 'MANUAL' ? messages.manual : messages.scanner}
                </p>
                <p>
                  <strong>{messages.reviewedAt}:</strong>{' '}
                  <time dateTime={review.reviewedAt}>
                    {new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(review.reviewedAt))}
                  </time>
                </p>
                {review.reviewedBy ? (
                  <p>
                    <strong>{messages.reviewedBy}:</strong> {review.reviewedBy.displayName}
                  </p>
                ) : null}
                <p>
                  <strong>{messages.reason}:</strong> {review.reason ?? messages.reasonRestricted}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="admin-workflow-notice" aria-live={conflict ? 'assertive' : 'polite'}>
        {notice}
      </p>
      {conflict ? (
        <button className="button button-secondary" type="button" onClick={() => router.refresh()}>
          {messages.refresh}
        </button>
      ) : null}
    </div>
  );
}
