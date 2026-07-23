// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminIncidentDetailView } from '../src/components/admin/admin-incident-detail';
import type { AdminIncidentDetail } from '../src/lib/admin-incidents-api';
import { submitIncidentReport } from '../src/lib/public-api';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../src/lib/env', () => ({
  webEnvironment: { NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api' },
}));

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const detail = {
  id: incidentId,
  internalCaseId: 'GAR-20260723-0001',
  category: { id: incidentId, nameHa: 'Tsaro', nameEn: 'Safety' },
  status: 'NEW',
  severity: 'LOW',
  submissionLanguage: 'ha',
  state: null,
  lga: null,
  locationDescription: null,
  incidentDate: null,
  submittedAt: '2026-07-23T12:00:00.000Z',
  assignedTo: null,
  description: 'Synthetic report.',
  incidentTime: null,
  latitude: null,
  longitude: null,
  duplicateOfIncidentId: null,
  updatedAt: '2026-07-23T12:00:00.000Z',
  closedAt: null,
  statusHistory: [],
  assignmentHistory: [],
} satisfies AdminIncidentDetail;

afterEach(cleanup);

describe('incident attachment web integration', () => {
  it('keeps text-only submissions JSON and uses multipart only when files are selected', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('{}', { status: 201 }));
    const payload = {
      categoryId: incidentId,
      description: 'A sufficiently detailed report description.',
      severity: 'LOW' as const,
      submissionLanguage: 'ha' as const,
    };
    await submitIncidentReport('http://localhost:4000/api', payload, { fetcher });
    expect(fetcher.mock.calls[0]![0]).toContain('/public/incidents');
    expect(fetcher.mock.calls[0]![1]?.headers).toMatchObject({
      'Content-Type': 'application/json',
    });

    const file = new File([new Uint8Array([1, 2, 3])], 'proof.png', { type: 'image/png' });
    await submitIncidentReport('http://localhost:4000/api', payload, {
      fetcher,
      attachments: [file],
    });
    expect(fetcher.mock.calls[1]![0]).toContain('/public/incidents/with-attachments');
    expect(fetcher.mock.calls[1]![1]?.body).toBeInstanceOf(FormData);
    expect(fetcher.mock.calls[1]![1]?.headers).not.toHaveProperty('Content-Type');
  });

  it('renders metadata-only access for ANALYST and content only for allowed AVAILABLE files', () => {
    const attachments = [
      {
        id: incidentId,
        originalFilename: '<evidence>.pdf',
        verifiedMimeType: 'application/pdf',
        sizeBytes: 1024,
        width: null,
        height: null,
        pageCount: null,
        status: 'AVAILABLE' as const,
        uploadedAt: '2026-07-23T12:00:00.000Z',
        availableAt: '2026-07-23T12:05:00.000Z',
      },
    ];
    const { rerender, container } = render(
      <AdminIncidentDetailView
        locale="en"
        incident={detail}
        role="ANALYST"
        attachments={attachments}
      />,
    );
    expect(screen.getByText('Your role permits metadata review only.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Download evidence/ })).toBeNull();
    expect(container.querySelector('script')).toBeNull();

    rerender(
      <AdminIncidentDetailView
        locale="en"
        incident={detail}
        role="MODERATOR"
        attachments={attachments}
      />,
    );
    expect(screen.getByRole('link', { name: /Download evidence/ })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/objectKey|sha256|filesystem/i);
  });
});
