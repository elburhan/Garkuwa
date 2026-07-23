'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getMessages, type Locale } from '@/i18n';
import {
  createIncidentNote,
  editIncidentNote,
  loadNoteRevisions,
  redactIncidentNote,
  type NoteApiResult,
  type NoteRevisions,
} from '@/lib/admin-incident-notes-api';
import type { StaffNote, StaffNotes } from '@/lib/admin-incidents-api';

type NotesRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'ANALYST';

function failureMessage(
  result: Exclude<NoteApiResult, { kind: 'success' }>,
  messages: ReturnType<typeof getMessages>['admin']['incidents']['staffNotes'],
): string {
  if (result.kind === 'validation') return messages.validationError;
  if (result.kind === 'unauthenticated') return messages.sessionExpired;
  if (result.kind === 'forbidden') return messages.forbidden;
  if (result.kind === 'not-found') return messages.notFound;
  if (result.kind === 'conflict') return messages.staleVersion;
  if (result.kind === 'rate-limit') return messages.rateLimited;
  return messages.genericError;
}

function mayCorrect(note: StaffNote, role: NotesRole, principalId: string): boolean {
  if (note.isDeleted || role === 'ANALYST') return false;
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;
  return (
    note.author.id === principalId &&
    Date.now() - new Date(note.createdAt).getTime() <= 15 * 60 * 1000
  );
}

function isOwnRecentNote(note: StaffNote, principalId: string): boolean {
  return (
    !note.isDeleted &&
    note.author.id === principalId &&
    Date.now() - new Date(note.createdAt).getTime() <= 15 * 60 * 1000
  );
}

export function AdminIncidentNotes({
  locale,
  incidentId,
  principalId,
  role,
  notes,
}: Readonly<{
  locale: Locale;
  incidentId: string;
  principalId: string;
  role: NotesRole;
  notes: StaffNotes['items'];
}>) {
  const router = useRouter();
  const messages = getMessages(locale).admin.incidents.staffNotes;
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<StaffNote | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editReason, setEditReason] = useState('');
  const [redacting, setRedacting] = useState<StaffNote | null>(null);
  const [redactionReason, setRedactionReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [revisions, setRevisions] = useState<Record<string, NoteRevisions['items']>>({});
  const statusReference = useRef<HTMLParagraphElement>(null);
  const canCreate = role !== 'ANALYST';
  const canAdminister = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const administrativeReasonRequired =
    editing !== null && canAdminister && !isOwnRecentNote(editing, principalId);

  function announce(message: string): void {
    setNotice(message);
    queueMicrotask(() => statusReference.current?.focus());
  }

  async function createNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body.trim().length < 2) return announce(messages.validationError);
    setPending(true);
    const result = await createIncidentNote(incidentId, body);
    setPending(false);
    if (result.kind === 'success') {
      setBody('');
      announce(messages.noteAdded);
      router.refresh();
    } else announce(failureMessage(result, messages));
  }

  async function saveCorrection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || editing.isDeleted) return;
    setPending(true);
    const result = await editIncidentNote(incidentId, editing.id, {
      body: editBody,
      expectedVersion: editing.version,
      ...(editReason.trim() ? { reason: editReason } : {}),
    });
    setPending(false);
    if (result.kind === 'success') {
      setEditing(null);
      setEditReason('');
      announce(messages.noteCorrected);
      router.refresh();
    } else announce(failureMessage(result, messages));
  }

  async function redact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!redacting || redacting.isDeleted || !confirmed) {
      return announce(messages.confirmRedactionRequired);
    }
    setPending(true);
    const result = await redactIncidentNote(incidentId, redacting.id, {
      reason: redactionReason,
      expectedVersion: redacting.version,
    });
    setPending(false);
    if (result.kind === 'success') {
      setRedacting(null);
      setRedactionReason('');
      setConfirmed(false);
      announce(messages.noteHidden);
      router.refresh();
    } else announce(failureMessage(result, messages));
  }

  async function showRevisions(noteId: string) {
    setPending(true);
    const result = await loadNoteRevisions(incidentId, noteId);
    setPending(false);
    if (result.kind === 'success') {
      setRevisions((current) => ({ ...current, [noteId]: result.data.items }));
      announce(messages.revisionsLoaded);
    } else announce(failureMessage(result, messages));
  }

  const dateFormatter = new Intl.DateTimeFormat(locale === 'ha' ? 'ha-NG' : 'en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <section className="admin-detail-card admin-staff-notes" aria-labelledby="staff-notes-title">
      <h2 id="staff-notes-title">{messages.title}</h2>
      <p className="admin-read-only-notice">{messages.internalOnly}</p>
      <p className="field-help">{messages.privacyWarning}</p>

      {canCreate ? (
        <form onSubmit={createNote}>
          <fieldset disabled={pending}>
            <legend>{messages.addNote}</legend>
            <label htmlFor="staff-note-body">{messages.noteBody}</label>
            <textarea
              id="staff-note-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              minLength={2}
              maxLength={5000}
              required
              aria-describedby="staff-note-count staff-notes-status"
              aria-invalid={body.length > 0 && body.trim().length < 2 ? true : undefined}
            />
            <span id="staff-note-count">
              {messages.characterCounter.replace('{count}', String(body.length))}
            </span>
            <button type="submit" className="button">
              {pending ? messages.loading : messages.addNote}
            </button>
          </fieldset>
        </form>
      ) : (
        <p>{messages.readOnly}</p>
      )}

      <p
        id="staff-notes-status"
        ref={statusReference}
        tabIndex={-1}
        aria-live="polite"
        className="admin-workflow-notice"
      >
        {notice}
      </p>

      {notes.length === 0 ? (
        <p>{messages.noNotes}</p>
      ) : (
        <ol className="admin-note-list">
          {notes.map((note) => (
            <li key={note.id}>
              <header>
                <strong>{note.author.displayName}</strong>
                <time dateTime={note.createdAt}>
                  {dateFormatter.format(new Date(note.createdAt))}
                </time>
              </header>
              {note.isDeleted ? (
                <p>{messages.deletedTombstone}</p>
              ) : (
                <>
                  <p className="admin-note-body">{note.body}</p>
                  {note.editedAt ? <p className="field-help">{messages.edited}</p> : null}
                  <div className="admin-note-actions">
                    {mayCorrect(note, role, principalId) ? (
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => {
                          setEditing(note);
                          setEditBody(note.body);
                          setEditReason('');
                        }}
                      >
                        {messages.correctNote}
                      </button>
                    ) : null}
                    {canAdminister ? (
                      <>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => setRedacting(note)}
                        >
                          {messages.redactNote}
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          disabled={pending}
                          onClick={() => showRevisions(note.id)}
                        >
                          {messages.revisionHistory}
                        </button>
                      </>
                    ) : null}
                  </div>
                </>
              )}
              {revisions[note.id] ? (
                <section aria-label={messages.revisionHistory}>
                  <ol className="admin-note-revisions">
                    {(revisions[note.id] ?? []).map((revision) => (
                      <li key={revision.revisionNumber}>
                        <h3>
                          {messages.revisionNumber.replace(
                            '{number}',
                            String(revision.revisionNumber),
                          )}
                        </h3>
                        <p className="admin-note-body">{revision.body}</p>
                        <p>
                          {messages.changedBy}: {revision.changedBy.displayName}
                        </p>
                        <time dateTime={revision.changedAt}>
                          {dateFormatter.format(new Date(revision.changedAt))}
                        </time>
                        {revision.changeReason ? <p>{revision.changeReason}</p> : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {editing && !editing.isDeleted ? (
        <form onSubmit={saveCorrection} className="admin-note-dialog">
          <fieldset disabled={pending}>
            <legend>{messages.correctNote}</legend>
            <label htmlFor="staff-note-correction">{messages.noteBody}</label>
            <textarea
              id="staff-note-correction"
              value={editBody}
              onChange={(event) => setEditBody(event.target.value)}
              minLength={2}
              maxLength={5000}
              required
            />
            {canAdminister ? (
              <>
                <label htmlFor="staff-note-correction-reason">{messages.correctionReason}</label>
                <textarea
                  id="staff-note-correction-reason"
                  value={editReason}
                  onChange={(event) => setEditReason(event.target.value)}
                  minLength={10}
                  maxLength={1000}
                  required={administrativeReasonRequired}
                />
              </>
            ) : null}
            <p>{messages.historyRetained}</p>
            <div className="admin-note-actions">
              <button type="submit" className="button">
                {pending ? messages.loading : messages.saveCorrection}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setEditing(null)}
              >
                {messages.cancel}
              </button>
            </div>
          </fieldset>
        </form>
      ) : null}

      {redacting && !redacting.isDeleted ? (
        <form onSubmit={redact} className="admin-note-dialog">
          <fieldset disabled={pending}>
            <legend>{messages.redactNote}</legend>
            <label htmlFor="staff-note-redaction-reason">{messages.redactionReason}</label>
            <textarea
              id="staff-note-redaction-reason"
              value={redactionReason}
              onChange={(event) => setRedactionReason(event.target.value)}
              minLength={10}
              maxLength={1000}
              required
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              {messages.confirmRedaction}
            </label>
            <div className="admin-note-actions">
              <button type="submit" className="button">
                {pending ? messages.loading : messages.redactNote}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setRedacting(null)}
              >
                {messages.cancel}
              </button>
            </div>
          </fieldset>
        </form>
      ) : null}
    </section>
  );
}
