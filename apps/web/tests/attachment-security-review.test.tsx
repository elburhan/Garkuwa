// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminAttachmentSecurityReview } from '../src/components/admin/admin-attachment-security-review';
import type { IncidentAttachments } from '../src/lib/admin-incidents-api';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('../src/lib/env', () => ({
  webEnvironment: { NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api' },
}));

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const attachment: IncidentAttachments['items'][number] = {
  id: 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0',
  originalFilename: 'evidence.pdf',
  verifiedMimeType: 'application/pdf',
  sizeBytes: 100,
  width: null,
  height: null,
  pageCount: null,
  status: 'QUARANTINED',
  uploadedAt: '2026-07-23T20:40:00.000Z',
  availableAt: null,
  updatedAt: '2026-07-23T20:45:00.000Z',
  reviewedAt: null,
  reviewSource: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  refresh.mockReset();
});

describe('attachment security-review UI', () => {
  it.each(['ADMIN', 'SUPER_ADMIN'] as const)(
    'shows terminal manual-review controls to %s for quarantined evidence',
    (role) => {
      render(
        <AdminAttachmentSecurityReview
          locale="en"
          incidentId={incidentId}
          attachment={attachment}
          role={role}
          reviews={[]}
        />,
      );
      expect(screen.getByRole('group', { name: 'Attachment security review' })).toBeTruthy();
      expect(screen.getByText(/does not prove/)).toBeTruthy();
      expect(document.body.textContent).not.toMatch(/virus-free|malware-free/i);
      expect(document.body.textContent).not.toMatch(/objectKey|sha256|filesystem/i);
    },
  );

  it.each(['MODERATOR', 'ANALYST'] as const)('does not render review controls for %s', (role) => {
    render(
      <AdminAttachmentSecurityReview
        locale="en"
        incidentId={incidentId}
        attachment={attachment}
        role={role}
        reviews={[]}
      />,
    );
    expect(screen.queryByRole('group', { name: 'Attachment security review' })).toBeNull();
  });

  it.each(['AVAILABLE', 'REJECTED'] as const)(
    'does not render controls after terminal %s decision',
    (status) => {
      render(
        <AdminAttachmentSecurityReview
          locale="en"
          incidentId={incidentId}
          attachment={{ ...attachment, status }}
          role="ADMIN"
          reviews={[]}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Submit security review' })).toBeNull();
    },
  );

  it('requires a valid reason and acknowledgement before sending strict JSON', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    render(
      <AdminAttachmentSecurityReview
        locale="en"
        incidentId={incidentId}
        attachment={attachment}
        role="ADMIN"
        reviews={[]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Review decision'), {
      target: { value: 'AVAILABLE' },
    });
    fireEvent.change(screen.getByLabelText('Review reason'), {
      target: { value: 'short' },
    });
    fireEvent.submit(
      screen.getByRole('group', { name: 'Attachment security review' }).closest('form')!,
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 10/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Review reason'), {
      target: { value: 'Reviewed in an approved isolated environment.' },
    });
    fireEvent.click(screen.getByLabelText(/manual approval does not guarantee/));
    fireEvent.click(screen.getByRole('button', { name: 'Submit security review' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      method: 'PATCH',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
    expect(String(fetcher.mock.calls[0]![1]?.body)).toContain(attachment.updatedAt);
    expect(refresh).toHaveBeenCalled();
  });

  it('renders role-restricted history and a safe stale-version action', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 409 }));
    render(
      <AdminAttachmentSecurityReview
        locale="en"
        incidentId={incidentId}
        attachment={attachment}
        role="ADMIN"
        reviews={[
          {
            id: '7195c264-3660-41ac-b6c4-967f01dce85f',
            decision: 'AVAILABLE',
            reviewSource: 'MANUAL',
            reason: null,
            reviewedAt: '2026-07-23T20:46:00.000Z',
            reviewedBy: { id: incidentId, displayName: 'Reviewer' },
            scanner: null,
          },
        ]}
      />,
    );
    expect(
      screen.getByText('The full review reason is restricted to administrators.'),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Review decision'), {
      target: { value: 'AVAILABLE' },
    });
    fireEvent.change(screen.getByLabelText('Review reason'), {
      target: { value: 'Reviewed in an approved isolated environment.' },
    });
    fireEvent.click(screen.getByLabelText(/manual approval does not guarantee/));
    fireEvent.click(screen.getByRole('button', { name: 'Submit security review' }));
    expect(await screen.findByText(/changed elsewhere/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh page' })).toBeTruthy();
  });
});
