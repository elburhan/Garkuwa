'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import type { AdminPrincipal } from '@/lib/admin-auth';
import {
  adminMediaContentUrl,
  archiveAdminMedia,
  type AdminMediaList,
  updateAdminMedia,
  uploadAdminMedia,
} from '@/lib/admin-media-api';

export function AdminMediaLibrary({
  locale,
  principal,
  media,
}: Readonly<{ locale: Locale; principal: AdminPrincipal; media: AdminMediaList }>) {
  const messages = getMessages(locale).admin.media;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const canArchive = principal.role === 'SUPER_ADMIN' || principal.role === 'ADMIN';
  const canEdit = canArchive || principal.role === 'MODERATOR';

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setNotice('');
    const result = await uploadAdminMedia(new FormData(form));
    setPending(false);
    if (result.kind === 'success') {
      const value = result.data as { exactDuplicateOfId?: unknown };
      setNotice(value.exactDuplicateOfId ? messages.duplicate : messages.uploaded);
      form.reset();
      router.refresh();
    } else setNotice(messages.failed);
  }

  async function archive(id: string, updatedAt: string) {
    setPending(true);
    const result = await archiveAdminMedia(id, updatedAt);
    setPending(false);
    setNotice(result.kind === 'success' ? messages.archived : messages.failed);
    if (result.kind === 'success') router.refresh();
  }

  async function update(event: React.FormEvent<HTMLFormElement>, id: string, updatedAt: string) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const optional = (name: string) => String(values.get(name) ?? '').trim() || null;
    setPending(true);
    const result = await updateAdminMedia(id, {
      altTextHa: String(values.get('altTextHa') ?? ''),
      altTextEn: optional('altTextEn'),
      captionHa: optional('captionHa'),
      captionEn: optional('captionEn'),
      credit: optional('credit'),
      source: optional('source'),
      rightsNotes: optional('rightsNotes'),
      provenance: String(values.get('provenance') ?? 'OTHER'),
      expectedUpdatedAt: updatedAt,
    });
    setPending(false);
    setNotice(
      result.kind === 'success'
        ? messages.detailsSaved
        : result.kind === 'conflict'
          ? messages.conflict
          : messages.failed,
    );
    if (result.kind === 'success') router.refresh();
  }

  return (
    <>
      <form className="admin-news-form" onSubmit={upload}>
        <fieldset disabled={pending}>
          <legend>{messages.upload}</legend>
          <label htmlFor="media-image">{messages.chooseFile}</label>
          <input
            id="media-image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
          <label htmlFor="media-alt-ha">{messages.altTextHa}</label>
          <input id="media-alt-ha" name="altTextHa" minLength={5} maxLength={500} required />
          <label htmlFor="media-alt-en">{messages.altTextEn}</label>
          <input id="media-alt-en" name="altTextEn" minLength={5} maxLength={500} />
          <label htmlFor="media-caption-ha">{messages.captionHa}</label>
          <textarea id="media-caption-ha" name="captionHa" maxLength={1000} />
          <label htmlFor="media-caption-en">{messages.captionEn}</label>
          <textarea id="media-caption-en" name="captionEn" maxLength={1000} />
          <label htmlFor="media-credit">{messages.credit}</label>
          <input id="media-credit" name="credit" maxLength={300} />
          <label htmlFor="media-source">{messages.source}</label>
          <input id="media-source" name="source" maxLength={500} />
          <label htmlFor="media-provenance">{messages.provenance}</label>
          <select id="media-provenance" name="provenance" defaultValue="STAFF">
            {['STAFF', 'AGENCY', 'OFFICIAL', 'CITIZEN_APPROVED', 'EXTERNAL', 'OTHER'].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
          <details>
            <summary>{messages.rightsNotes}</summary>
            <textarea name="rightsNotes" maxLength={2000} />
          </details>
          <button className="button" type="submit">
            {pending ? messages.uploading : messages.upload}
          </button>
        </fieldset>
        <p role="status" aria-live="polite">
          {notice}
        </p>
      </form>
      <p className="admin-read-only-notice">{messages.isolation}</p>
      {media.items.length === 0 ? (
        <p>{messages.empty}</p>
      ) : (
        <ul className="admin-media-grid">
          {media.items.map((item) => (
            <li key={item.id} className="admin-detail-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={adminMediaContentUrl(item.id)}
                alt={item.altTextHa}
                width={item.width ?? 320}
                height={item.height ?? 180}
                loading="lazy"
              />
              <p>{item.captionHa ?? item.originalFilename}</p>
              {item.credit ? (
                <p>
                  {messages.credit}: {item.credit}
                </p>
              ) : null}
              <p>
                {messages.uploadedBy}: {item.uploadedBy.displayName}
              </p>
              {canEdit && item.status === 'ACTIVE' ? (
                <details>
                  <summary>{messages.editDetails}</summary>
                  <form
                    className="admin-media-metadata-form"
                    onSubmit={(event) => update(event, item.id, item.updatedAt)}
                  >
                    <label>
                      {messages.altTextHa}
                      <input
                        name="altTextHa"
                        minLength={5}
                        maxLength={500}
                        required
                        defaultValue={item.altTextHa}
                      />
                    </label>
                    <label>
                      {messages.altTextEn}
                      <input
                        name="altTextEn"
                        minLength={5}
                        maxLength={500}
                        defaultValue={item.altTextEn ?? ''}
                      />
                    </label>
                    <label>
                      {messages.captionHa}
                      <textarea
                        name="captionHa"
                        maxLength={1000}
                        defaultValue={item.captionHa ?? ''}
                      />
                    </label>
                    <label>
                      {messages.captionEn}
                      <textarea
                        name="captionEn"
                        maxLength={1000}
                        defaultValue={item.captionEn ?? ''}
                      />
                    </label>
                    <label>
                      {messages.credit}
                      <input name="credit" maxLength={300} defaultValue={item.credit ?? ''} />
                    </label>
                    <label>
                      {messages.source}
                      <input name="source" maxLength={500} defaultValue={item.source ?? ''} />
                    </label>
                    <label>
                      {messages.provenance}
                      <select name="provenance" defaultValue={item.provenance}>
                        {[
                          'STAFF',
                          'AGENCY',
                          'OFFICIAL',
                          'CITIZEN_APPROVED',
                          'EXTERNAL',
                          'OTHER',
                        ].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {messages.rightsNotes}
                      <textarea
                        name="rightsNotes"
                        maxLength={2000}
                        defaultValue={item.rightsNotes ?? ''}
                      />
                    </label>
                    <button className="button" type="submit" disabled={pending}>
                      {messages.saveDetails}
                    </button>
                  </form>
                </details>
              ) : null}
              {canArchive && item.status === 'ACTIVE' ? (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={pending}
                  onClick={() => archive(item.id, item.updatedAt)}
                >
                  {messages.archive}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
