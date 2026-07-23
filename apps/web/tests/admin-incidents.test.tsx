// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminAccessDenied } from '../src/components/admin/admin-access-denied';
import { AdminIncidentDetailView } from '../src/components/admin/admin-incident-detail';
import { AdminIncidentQueue } from '../src/components/admin/admin-incident-queue';
import type {
  AdminIncidentDetail,
  AdminIncidentQueue as QueueResponse,
} from '../src/lib/admin-incidents-api';
import { buildAdminIncidentsPath } from '../src/lib/admin-incidents-api';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, replace: vi.fn() }) }));

vi.mock('../src/lib/env', () => ({
  webEnvironment: {
    NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

const queue: QueueResponse = {
  items: [
    {
      id: '52fc7e20-ab06-4f7c-8d3c-15f075275fd3',
      internalCaseId: 'GAR-20260722-0001',
      category: {
        id: 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0',
        nameHa: 'Tsaro',
        nameEn: 'Safety',
      },
      status: 'NEW',
      severity: 'MEDIUM',
      submissionLanguage: 'ha',
      state: 'Kano',
      lga: 'Nassarawa',
      locationDescription: 'Wurin gwaji',
      incidentDate: null,
      submittedAt: '2026-07-22T12:00:00.000Z',
      assignedTo: null,
    },
  ],
  pagination: { page: 2, pageSize: 20, totalItems: 41, totalPages: 3 },
};

const detail: AdminIncidentDetail = {
  ...queue.items[0]!,
  description: 'First paragraph.\n\n<script>unsafe()</script>\nSecond paragraph.',
  incidentTime: null,
  latitude: null,
  longitude: null,
  duplicateOfIncidentId: null,
  updatedAt: '2026-07-22T13:00:00.000Z',
  closedAt: null,
  statusHistory: [
    {
      fromStatus: null,
      toStatus: 'NEW',
      changedAt: '2026-07-22T12:00:00.000Z',
      changedBy: null,
      comment: null,
    },
  ],
  assignmentHistory: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  refresh.mockClear();
});

describe('read-only admin incident web interface', () => {
  it('renders independently localized Hausa and English queue labels without report text', () => {
    render(
      <AdminIncidentQueue locale="ha" queue={queue} parameters={{ page: '2' }} categories={[]} />,
    );
    expect(screen.getByRole('heading', { name: 'Jerin rahotannin lamura' })).toBeTruthy();
    expect(screen.getAllByText('Sabo').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('First paragraph');
    expect(document.body.textContent).not.toMatch(/phone|email|imel|lambar waya/i);
    cleanup();

    render(
      <AdminIncidentQueue locale="en" queue={queue} parameters={{ page: '2' }} categories={[]} />,
    );
    expect(screen.getByRole('heading', { name: 'Incident queue' })).toBeTruthy();
    expect(screen.getAllByText('New').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
  });

  it('builds deterministic filter and pagination links while preserving filters', () => {
    expect(
      buildAdminIncidentsPath(
        { status: 'NEW', search: 'Kano', page: '2', ignored: 'secret' },
        { page: 3 },
        'en',
      ),
    ).toBe('/admin/incidents?page=3&status=NEW&search=Kano&lang=en');

    render(
      <AdminIncidentQueue
        locale="en"
        queue={queue}
        parameters={{ status: 'NEW', search: 'Kano', page: '2' }}
        categories={[]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Previous page' }).getAttribute('href')).toContain(
      'status=NEW',
    );
    expect(screen.getByRole('link', { name: 'Next page' }).getAttribute('href')).toContain(
      'search=Kano',
    );
  });

  it('renders paragraphs as text and exposes no editing or contact-reveal actions', () => {
    const { container } = render(
      <AdminIncidentDetailView locale="en" incident={detail} role="ANALYST" />,
    );
    expect(screen.getByText(/First paragraph/).textContent).toContain('<script>unsafe()</script>');
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('Status history')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.body.textContent).not.toMatch(/reveal contact|change status|assign incident/i);
  });

  it('shows only role-authorized workflow controls and allowed transitions', () => {
    const { rerender } = render(
      <AdminIncidentDetailView locale="en" incident={detail} role="MODERATOR" />,
    );
    expect(screen.getByRole('group', { name: 'Change status' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Assign incident' })).toBeNull();
    const status = screen.getByLabelText('Next status');
    expect(status.textContent).toContain('Under review');
    expect(status.textContent).toContain('Rejected');
    expect(status.textContent).not.toContain('Closed');

    rerender(
      <AdminIncidentDetailView
        locale="en"
        incident={detail}
        role="ADMIN"
        eligibleAssignees={[
          {
            id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
            displayName: 'Moderator',
            email: 'moderator@example.test',
            role: 'MODERATOR',
          },
        ]}
      />,
    );
    expect(screen.getByRole('group', { name: 'Assign incident' })).toBeTruthy();
  });

  it('requires reason and confirmation for rejection and handles conflicts safely', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 409, headers: { 'Content-Type': 'application/json' } }),
    );
    render(<AdminIncidentDetailView locale="en" incident={detail} role="MODERATOR" />);
    await user.selectOptions(screen.getByLabelText('Next status'), 'REJECTED');
    await user.click(screen.getByRole('button', { name: 'Change status' }));
    expect(screen.getByText('A reason is required for this transition.')).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Transition reason'), 'Reviewed evidence');
    await user.click(screen.getByLabelText('I confirm that this incident should be rejected.'));
    await user.click(screen.getByRole('button', { name: 'Change status' }));
    expect(await screen.findByText(/changed elsewhere/i)).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/admin/incidents/${detail.id}/status`),
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('renders a localized access-denied view for unauthorized staff', () => {
    render(<AdminAccessDenied locale="ha" />);
    expect(screen.getByRole('heading', { name: 'Ba ka da izinin shiga' })).toBeTruthy();
  });

  it('uses server-side authentication and role checks on queue and detail routes', () => {
    const queueSource = readFileSync(
      resolve(process.cwd(), 'src/app/(default)/admin/incidents/page.tsx'),
      'utf8',
    );
    const detailSource = readFileSync(
      resolve(process.cwd(), 'src/app/(default)/admin/incidents/[incidentId]/page.tsx'),
      'utf8',
    );
    for (const source of [queueSource, detailSource]) {
      expect(source).toContain('await getAdminPrincipal()');
      expect(source).toContain('incidentViewerRoles.has(principal.role)');
      expect(source).toContain('redirect(`/admin/login?lang=${locale}&reason=expired`)');
    }
    expect(detailSource).toContain("if (result.kind === 'not-found') notFound()");
    expect(detailSource).not.toContain('response.text()');
  });

  it('forwards only the staff cookie through the server-side authenticated API helper', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/admin-incidents-api.ts'), 'utf8');
    expect(source).toContain("cache: 'no-store'");
    expect(source).toContain('Cookie: `${staffSessionCookieName}=${token}`');
    expect(source).not.toContain('Authorization:');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
  });

  it('does not store workflow credentials or expose contact actions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/admin-incident-workflow-api.ts'),
      'utf8',
    );
    expect(source).toContain("credentials: 'include'");
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('Cookie');
    expect(source).not.toMatch(/reveal|decrypt/i);
  });
});
