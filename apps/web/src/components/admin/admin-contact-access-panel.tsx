'use client';

import { useEffect, useRef, useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import {
  revealIncidentContact,
  type ContactAccessResult,
  type RevealedContact,
} from '@/lib/admin-contact-access-api';
import type { ContactAccessHistory } from '@/lib/admin-incidents-api';

const AUTO_HIDE_MS = 2 * 60 * 1000;

function failureMessage(
  result: Exclude<ContactAccessResult, { kind: 'success' }>,
  messages: ReturnType<typeof getMessages>['admin']['incidents']['contactAccess'],
): string {
  if (result.kind === 'not-found') return messages.unavailable;
  if (result.kind === 'rate-limit') return messages.rateLimited;
  if (result.kind === 'forbidden') return messages.forbidden;
  if (result.kind === 'unauthenticated') return messages.sessionExpired;
  if (result.kind === 'validation') return messages.reasonError;
  return messages.revealFailed;
}

export function AdminContactAccessPanel({
  locale,
  incidentId,
  history,
}: Readonly<{
  locale: Locale;
  incidentId: string;
  history: ContactAccessHistory['items'];
}>) {
  const messages = getMessages(locale).admin.incidents.contactAccess;
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [revealed, setRevealed] = useState<RevealedContact | null>(null);
  const [notice, setNotice] = useState('');
  const resultReference = useRef<HTMLDivElement>(null);
  const reasonValid = reason.trim().length >= 10 && reason.trim().length <= 1000;

  useEffect(() => {
    if (!revealed) return;
    resultReference.current?.focus();
    const timeout = window.setTimeout(() => {
      setRevealed(null);
      setNotice(messages.autoHidden);
    }, AUTO_HIDE_MS);
    return () => window.clearTimeout(timeout);
  }, [messages.autoHidden, revealed]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    if (!reasonValid) {
      setNotice(messages.reasonError);
      return;
    }
    if (!acknowledged) {
      setNotice(messages.acknowledgementRequired);
      return;
    }
    setPending(true);
    const result = await revealIncidentContact(incidentId, reason);
    setPending(false);
    if (result.kind === 'success') {
      setRevealed(result.data);
      setReason('');
      setAcknowledged(false);
      setNotice(messages.accessRecorded);
    } else {
      setNotice(failureMessage(result, messages));
    }
  }

  function hide(): void {
    setRevealed(null);
    setNotice(messages.hidden);
  }

  return (
    <section className="admin-detail-card admin-contact-access" aria-labelledby="contact-title">
      <h2 id="contact-title">{messages.title}</h2>
      <p className="admin-read-only-notice">{messages.restrictedNotice}</p>
      {!revealed ? (
        <form onSubmit={submit}>
          <fieldset disabled={pending}>
            <legend>{messages.officialFollowUp}</legend>
            <label htmlFor="contact-access-reason">{messages.reason}</label>
            <p id="contact-access-reason-help" className="field-help">
              {messages.reasonHelp}
            </p>
            <textarea
              id="contact-access-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={1000}
              required
              aria-describedby="contact-access-reason-help contact-access-status"
              aria-invalid={reason.length > 0 && !reasonValid ? true : undefined}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              {messages.acknowledgement}
            </label>
            <button type="submit" className="button">
              {pending ? messages.revealing : messages.reveal}
            </button>
          </fieldset>
        </form>
      ) : (
        <div ref={resultReference} tabIndex={-1} aria-labelledby="revealed-contact-title">
          <h3 id="revealed-contact-title">{messages.revealedTitle}</h3>
          <dl className="admin-detail-grid">
            <div>
              <dt>{messages.name}</dt>
              <dd>{revealed.contact.name ?? messages.notProvided}</dd>
            </div>
            <div>
              <dt>{messages.phone}</dt>
              <dd>{revealed.contact.phone ?? messages.notProvided}</dd>
            </div>
            <div>
              <dt>{messages.email}</dt>
              <dd>{revealed.contact.email ?? messages.notProvided}</dd>
            </div>
            <div>
              <dt>{messages.preferredMethod}</dt>
              <dd>{messages.methods[revealed.contact.preferredContactMethod]}</dd>
            </div>
            <div>
              <dt>{messages.safeInstructions}</dt>
              <dd>{revealed.contact.safeContactInstructions ?? messages.notProvided}</dd>
            </div>
            <div>
              <dt>{messages.consent}</dt>
              <dd>
                {revealed.contact.consentToContact
                  ? messages.consentGiven
                  : messages.consentNotGiven}
              </dd>
            </div>
            <div>
              <dt>{messages.accessedAt}</dt>
              <dd>
                <time dateTime={revealed.access.accessedAt}>
                  {new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(revealed.access.accessedAt))}
                </time>
              </dd>
            </div>
          </dl>
          <p className="admin-read-only-notice">{messages.privacyWarning}</p>
          <button type="button" className="button button-secondary" onClick={hide}>
            {messages.hide}
          </button>
        </div>
      )}
      <p id="contact-access-status" aria-live="polite" className="admin-workflow-notice">
        {notice}
      </p>

      <section aria-labelledby="contact-history-title">
        <h3 id="contact-history-title">{messages.historyTitle}</h3>
        {history.length === 0 ? (
          <p>{messages.noHistory}</p>
        ) : (
          <ol className="admin-status-history">
            {history.map((entry) => (
              <li key={entry.id}>
                <p>
                  <strong>{messages.accessedBy}:</strong> {entry.accessedBy.displayName}
                </p>
                <p>
                  <strong>{messages.accessedAt}:</strong>{' '}
                  <time dateTime={entry.accessedAt}>
                    {new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(entry.accessedAt))}
                  </time>
                </p>
                <p>
                  <strong>{messages.accessReason}:</strong> {entry.reason}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
