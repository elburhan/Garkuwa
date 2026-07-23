// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminIncidentNotes } from '../src/components/admin/admin-incident-notes';
import type { StaffNotes } from '../src/lib/admin-incidents-api';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('../src/lib/env', () => ({
  webEnvironment: { NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api' },
}));

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const principalId = '4051a8b6-1cbb-4570-9b82-e3c246a70f34';
const activeNote = {
  id: 'ec126223-35fd-4985-a2ff-b8903148ae77',
  body: 'First paragraph.\n\n<script>literal()</script>',
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  editedAt: null,
  author: { id: principalId, displayName: 'Test Moderator' },
  isDeleted: false,
} satisfies StaffNotes['items'][number];
const deletedNote = {
  id: '168fdf0c-88ca-4928-b5f6-f04674f70dcf',
  isDeleted: true,
  createdAt: '2026-07-23T12:00:00.000Z',
  deletedAt: '2026-07-23T12:05:00.000Z',
  author: { id: principalId, displayName: 'Test Moderator' },
} satisfies StaffNotes['items'][number];

afterEach(() => {
  cleanup();
  refresh.mockReset();
  vi.restoreAllMocks();
});

describe('admin incident staff notes', () => {
  it('renders analysts as read-only and renders HTML-like text as escaped plain text', () => {
    const { container } = render(
      <AdminIncidentNotes
        locale="en"
        incidentId={incidentId}
        principalId={principalId}
        role="ANALYST"
        notes={[activeNote, deletedNote]}
      />,
    );
    expect(screen.getByText('Your role has read-only access to internal notes.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull();
    expect(screen.getByText(/<script>literal\(\)<\/script>/)).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(/hidden by an authorized administrator/i)).toBeTruthy();
    expect(document.body.textContent).not.toContain('Reason used to redact');
  });

  it('shows moderator creation and eligible own-correction without redaction', () => {
    render(
      <AdminIncidentNotes
        locale="en"
        incidentId={incidentId}
        principalId={principalId}
        role="MODERATOR"
        notes={[activeNote]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Add note' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Correct note' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hide note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Revision history' })).toBeNull();
  });

  it('shows administrative redaction and revision controls', () => {
    render(
      <AdminIncidentNotes
        locale="ha"
        incidentId={incidentId}
        principalId={principalId}
        role="ADMIN"
        notes={[activeNote]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Bayanan haɗin gwiwar ma’aikata' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ɓoye bayani' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tarihin gyare-gyare' })).toBeTruthy();
  });

  it('uses credentialed strict JSON, clears a successful draft, and prevents double submit', async () => {
    const user = userEvent.setup();
    let resolveRequest: ((response: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    render(
      <AdminIncidentNotes
        locale="en"
        incidentId={incidentId}
        principalId={principalId}
        role="MODERATOR"
        notes={[]}
      />,
    );
    const textarea = screen.getByLabelText('Note body');
    await user.type(textarea, 'Internal test note');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    const savingButton = screen.getByRole('button', { name: 'Saving…' });
    expect((savingButton.closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/admin/incidents/${incidentId}/notes`),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    resolveRequest?.(new Response(null, { status: 201 }));
    expect(await screen.findByText('The internal note was added.')).toBeTruthy();
    expect((textarea as HTMLTextAreaElement).value).toBe('');
    expect(refresh).toHaveBeenCalled();
  });

  it('maps stale mutations to a safe refresh message', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 409 }));
    render(
      <AdminIncidentNotes
        locale="en"
        incidentId={incidentId}
        principalId={principalId}
        role="MODERATOR"
        notes={[activeNote]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Correct note' }));
    await user.clear(screen.getAllByLabelText('Note body')[1]!);
    await user.type(screen.getAllByLabelText('Note body')[1]!, 'Corrected test note');
    await user.click(screen.getByRole('button', { name: 'Save correction' }));
    expect(await screen.findByText(/changed elsewhere/i)).toBeTruthy();
  });

  it('does not use browser storage, raw HTML rendering, URLs, or logging for note content', () => {
    const helper = readFileSync(
      resolve(process.cwd(), 'src/lib/admin-incident-notes-api.ts'),
      'utf8',
    );
    const component = readFileSync(
      resolve(process.cwd(), 'src/components/admin/admin-incident-notes.tsx'),
      'utf8',
    );
    expect(helper).toContain("credentials: 'include'");
    expect(helper).toContain("cache: 'no-store'");
    expect(`${helper}${component}`).not.toContain('localStorage');
    expect(`${helper}${component}`).not.toContain('sessionStorage');
    expect(`${helper}${component}`).not.toContain('dangerouslySetInnerHTML');
    expect(`${helper}${component}`).not.toContain('console.');
  });
});
