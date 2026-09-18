'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getMessages, type Locale } from '@/i18n';
import type { AdminLiveEventDetail } from '@/lib/admin-live-api';
import {
  addLiveUpdate,
  correctLiveUpdate,
  pinLiveUpdate,
  updateLiveEventPublishing,
  updateLiveEventMetadata,
  withdrawLiveUpdate,
} from '@/lib/admin-live-api';
import type { AdminMedia } from '@/lib/admin-media-api';

const extra = {
  ha: {
    englishHeadline: 'Kanun Turanci (ba dole ba)',
    englishBody: 'Sabuntawar Turanci (ba dole ba)',
    photo: 'Hoto (ba dole ba)',
    noPhoto: 'Babu hoto',
    pin: 'Tsare a matsayin muhimmi',
    unpin: 'Cire tsarawa',
    correct: 'Gyara',
    withdraw: 'Janye',
    reason: 'Dalilin gyara ko janyewa',
    start: 'Fara rahoto kai tsaye',
    archive: 'Ajiye a tarihi',
    confirmClose: 'A tabbatar an kammala rahoton?',
    history: 'Tarihin aiki',
  },
  en: {
    englishHeadline: 'English headline (optional)',
    englishBody: 'English update (optional)',
    photo: 'Photo (optional)',
    noPhoto: 'No photo',
    pin: 'Pin as key update',
    unpin: 'Unpin',
    correct: 'Correct',
    withdraw: 'Withdraw',
    reason: 'Correction or withdrawal reason',
    start: 'Start live coverage',
    archive: 'Archive',
    confirmClose: 'End this live coverage?',
    history: 'Operational history',
  },
} as const;

export function AdminLiveDetail({
  locale,
  detail,
  canPostUpdates,
  canPublish,
  canEditMetadata,
  media,
}: Readonly<{
  locale: Locale;
  detail: AdminLiveEventDetail;
  canPostUpdates: boolean;
  canPublish: boolean;
  canEditMetadata: boolean;
  media: AdminMedia[];
}>) {
  const messages = getMessages(locale).admin.live;
  const labels = extra[locale];
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const { event, updates } = detail;
  const recoveryKey = `garkuwa-live-draft:${event.id}`;

  useEffect(() => {
    const saved = window.localStorage.getItem(recoveryKey);
    if (!saved) return;
    try {
      const value = JSON.parse(saved) as { headline?: string; body?: string };
      const form = document.getElementById('live-update-composer') as HTMLFormElement | null;
      if (form) {
        (form.elements.namedItem('headlineHa') as HTMLInputElement).value = value.headline ?? '';
        (form.elements.namedItem('bodyHa') as HTMLTextAreaElement).value = value.body ?? '';
      }
    } catch {
      window.localStorage.removeItem(recoveryKey);
    }
  }, [recoveryKey]);

  function saveRecovery(event: React.FormEvent<HTMLFormElement>) {
    const values = new FormData(event.currentTarget);
    window.localStorage.setItem(
      recoveryKey,
      JSON.stringify({
        headline: String(values.get('headlineHa') ?? ''),
        body: String(values.get('bodyHa') ?? ''),
      }),
    );
  }
  function outcome(kind: string) {
    setNotice(kind === 'conflict' ? messages.conflict : kind === 'success' ? '' : messages.failed);
    if (kind === 'success') router.refresh();
  }

  async function postUpdate(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    const values = new FormData(form);
    setPending(true);
    const result = await addLiveUpdate(event.id, {
      headlineHa: String(values.get('headlineHa') ?? '').trim() || null,
      headlineEn: String(values.get('headlineEn') ?? '').trim() || null,
      bodyHa: String(values.get('bodyHa') ?? ''),
      bodyEn: String(values.get('bodyEn') ?? '').trim() || null,
      mediaId: String(values.get('mediaId') ?? '').trim() || null,
      clientSubmissionId: crypto.randomUUID(),
    });
    setPending(false);
    if (result.kind === 'success') {
      setNotice(messages.updatePosted);
      form.reset();
      window.localStorage.removeItem(recoveryKey);
      router.refresh();
    } else outcome(result.kind);
  }

  async function saveMetadata(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const values = new FormData(formEvent.currentTarget);
    setPending(true);
    const result = await updateLiveEventMetadata(event.id, {
      categoryCode: event.category.code,
      titleHa: String(values.get('titleHa') ?? ''),
      titleEn: String(values.get('titleEn') ?? '').trim() || null,
      summaryHa: String(values.get('summaryHa') ?? '').trim() || null,
      summaryEn: String(values.get('summaryEn') ?? '').trim() || null,
      featuredMediaId: String(values.get('featuredMediaId') ?? '').trim() || null,
      expectedUpdatedAt: event.updatedAt,
    });
    setPending(false);
    outcome(result.kind);
  }

  async function lifecycle(action: 'START' | 'CLOSE' | 'REOPEN' | 'ARCHIVE') {
    if (action === 'CLOSE' && !window.confirm(labels.confirmClose)) return;
    setPending(true);
    const result = await updateLiveEventPublishing(event.id, {
      action,
      isFeatured: event.isFeatured,
      expectedUpdatedAt: event.updatedAt,
    });
    setPending(false);
    outcome(result.kind);
  }

  async function correction(
    formEvent: React.FormEvent<HTMLFormElement>,
    update: AdminLiveEventDetail['updates'][number],
  ) {
    formEvent.preventDefault();
    const values = new FormData(formEvent.currentTarget);
    setPending(true);
    const result = await correctLiveUpdate(event.id, update.id, {
      headlineHa: String(values.get('headlineHa') ?? '').trim() || null,
      headlineEn: String(values.get('headlineEn') ?? '').trim() || null,
      bodyHa: String(values.get('bodyHa') ?? ''),
      bodyEn: String(values.get('bodyEn') ?? '').trim() || null,
      reason: String(values.get('reason') ?? ''),
      expectedUpdatedAt: update.updatedAt,
    });
    setPending(false);
    outcome(result.kind);
  }

  async function withdrawal(
    formEvent: React.FormEvent<HTMLFormElement>,
    updateId: string,
    updatedAt: string,
  ) {
    formEvent.preventDefault();
    const reason = String(new FormData(formEvent.currentTarget).get('reason') ?? '');
    setPending(true);
    const result = await withdrawLiveUpdate(event.id, updateId, reason, updatedAt);
    setPending(false);
    outcome(result.kind);
  }

  return (
    <>
      <h1>{locale === 'en' ? (event.titleEn ?? event.titleHa) : event.titleHa}</h1>
      <p>
        {messages.status[event.status]}
        {event.isFeatured ? ` · ${messages.feature}` : ''}
      </p>
      {canPublish ? (
        <div className="admin-live-publishing-controls">
          {event.status === 'DRAFT' ? (
            <button disabled={pending} onClick={() => void lifecycle('START')}>
              {labels.start}
            </button>
          ) : null}
          {event.status === 'ACTIVE' ? (
            <button disabled={pending} onClick={() => void lifecycle('CLOSE')}>
              {messages.close}
            </button>
          ) : null}
          {event.status === 'CLOSED' ? (
            <button disabled={pending} onClick={() => void lifecycle('REOPEN')}>
              {messages.reopen}
            </button>
          ) : null}
          {event.status === 'ACTIVE' || event.status === 'CLOSED' ? (
            <button disabled={pending} onClick={() => void lifecycle('ARCHIVE')}>
              {labels.archive}
            </button>
          ) : null}
        </div>
      ) : null}
      <p role="status" aria-live="polite">
        {notice}
      </p>
      {canEditMetadata && event.status !== 'ARCHIVED' ? (
        <details>
          <summary>{locale === 'en' ? 'Edit coverage details' : 'Gyara bayanan rahoton'}</summary>
          <form className="admin-news-form" onSubmit={saveMetadata}>
            <fieldset disabled={pending}>
              <legend>{locale === 'en' ? 'Coverage details' : 'Bayanan rahoton'}</legend>
              <label htmlFor="event-title-ha">{messages.titleHa}</label>
              <input
                id="event-title-ha"
                name="titleHa"
                defaultValue={event.titleHa}
                required
                maxLength={180}
              />
              <label htmlFor="event-title-en">{labels.englishHeadline}</label>
              <input
                id="event-title-en"
                name="titleEn"
                defaultValue={event.titleEn ?? ''}
                maxLength={180}
              />
              <label htmlFor="event-summary-ha">{messages.summaryHa}</label>
              <textarea
                id="event-summary-ha"
                name="summaryHa"
                defaultValue={event.summaryHa ?? ''}
                maxLength={500}
              />
              <label htmlFor="event-summary-en">
                {locale === 'en'
                  ? 'English summary (optional)'
                  : 'Taƙaitaccen bayanin Turanci (ba dole ba)'}
              </label>
              <textarea
                id="event-summary-en"
                name="summaryEn"
                defaultValue={event.summaryEn ?? ''}
                maxLength={500}
              />
              <label htmlFor="event-featured-media">{labels.photo}</label>
              <select
                id="event-featured-media"
                name="featuredMediaId"
                defaultValue={event.featuredMediaId ?? ''}
              >
                <option value="">{labels.noPhoto}</option>
                {media.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.captionHa ?? item.originalFilename}
                  </option>
                ))}
              </select>
              <button type="submit">{locale === 'en' ? 'Save details' : 'Ajiye bayanai'}</button>
            </fieldset>
          </form>
        </details>
      ) : null}
      {canPostUpdates && event.status === 'ACTIVE' ? (
        <form
          id="live-update-composer"
          className="admin-news-form"
          onSubmit={postUpdate}
          onInput={saveRecovery}
        >
          <fieldset disabled={pending}>
            <legend>{messages.addUpdate}</legend>
            <label htmlFor="update-headline">{messages.updateHeadline}</label>
            <input id="update-headline" name="headlineHa" maxLength={180} />
            <label htmlFor="update-headline-en">{labels.englishHeadline}</label>
            <input id="update-headline-en" name="headlineEn" maxLength={180} />
            <label htmlFor="update-body">{messages.updateBody}</label>
            <textarea id="update-body" name="bodyHa" minLength={1} maxLength={5000} required />
            <label htmlFor="update-body-en">{labels.englishBody}</label>
            <textarea id="update-body-en" name="bodyEn" maxLength={5000} />
            <label htmlFor="update-media">{labels.photo}</label>
            <select id="update-media" name="mediaId">
              <option value="">{labels.noPhoto}</option>
              {media.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.captionHa ?? item.originalFilename}
                </option>
              ))}
            </select>
            <button type="submit">{pending ? '…' : messages.postUpdate}</button>
          </fieldset>
        </form>
      ) : null}
      <h2>{messages.updatesHeading}</h2>
      <ol className="admin-live-updates-feed">
        {updates.map((update) => (
          <li key={update.id}>
            {update.isPinned ? <strong>★</strong> : null}
            {update.headlineHa ? <strong>{update.headlineHa}</strong> : null}
            <p style={update.withdrawnAt ? { textDecoration: 'line-through' } : undefined}>
              {update.withdrawnAt ? messages.retracted : update.bodyHa}
            </p>
            {canPostUpdates && !update.withdrawnAt ? (
              <>
                <button
                  disabled={pending}
                  onClick={() =>
                    void pinLiveUpdate(
                      event.id,
                      update.id,
                      !update.isPinned,
                      update.updatedAt,
                    ).then((result) => outcome(result.kind))
                  }
                >
                  {update.isPinned ? labels.unpin : labels.pin}
                </button>
                <details>
                  <summary>{labels.correct}</summary>
                  <form onSubmit={(e) => void correction(e, update)}>
                    <label>
                      Hausa headline
                      <input name="headlineHa" defaultValue={update.headlineHa ?? ''} />
                    </label>
                    <label>
                      Hausa update
                      <textarea name="bodyHa" defaultValue={update.bodyHa} required />
                    </label>
                    <label>
                      {labels.englishHeadline}
                      <input name="headlineEn" defaultValue={update.headlineEn ?? ''} />
                    </label>
                    <label>
                      {labels.englishBody}
                      <textarea name="bodyEn" defaultValue={update.bodyEn ?? ''} />
                    </label>
                    <label>
                      {labels.reason}
                      <textarea name="reason" minLength={10} maxLength={1000} required />
                    </label>
                    <button disabled={pending}>{labels.correct}</button>
                  </form>
                </details>
                <details>
                  <summary>{labels.withdraw}</summary>
                  <form onSubmit={(e) => void withdrawal(e, update.id, update.updatedAt)}>
                    <label>
                      {labels.reason}
                      <textarea name="reason" minLength={10} maxLength={1000} required />
                    </label>
                    <button disabled={pending}>{labels.withdraw}</button>
                  </form>
                </details>
              </>
            ) : null}
            {update.revisions.length ? (
              <details>
                <summary>{labels.history}</summary>
                <ol>
                  {update.revisions.map((revision) => (
                    <li key={revision.id}>
                      <time>{revision.createdAt}</time> · {revision.reason}
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </li>
        ))}
      </ol>
      <section>
        <h2>{labels.history}</h2>
        <ol>
          {detail.operations.map((operation) => (
            <li key={operation.id}>
              {operation.action} · {operation.actor.displayName} ·{' '}
              <time>{operation.createdAt}</time>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
