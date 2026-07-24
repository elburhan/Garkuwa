// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminOperationsDashboard } from '../src/components/admin/admin-operations-dashboard';
import {
  dashboardPath,
  normalizeDashboardRange,
  type OperationsDashboard,
} from '../src/lib/admin-operations-dashboard-api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('../src/lib/env', () => ({
  webEnvironment: { NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api' },
}));

const dashboard = {
  generatedAt: '2026-07-24T08:00:00.000Z',
  range: {
    key: '30d',
    from: '2026-06-25T00:00:00.000Z',
    to: '2026-07-24T08:00:00.000Z',
  },
  overview: {
    totalIncidents: 7,
    newIncidents: 2,
    underReviewIncidents: 1,
    unassignedIncidents: 1,
    openIncidents: 4,
    closedIncidents: 2,
    rejectedIncidents: 1,
  },
  statusDistribution: [
    { status: 'NEW', count: 2 },
    { status: 'UNDER_REVIEW', count: 1 },
    { status: 'ACTIONED', count: 1 },
    { status: 'CLOSED', count: 2 },
    { status: 'REJECTED', count: 1 },
  ],
  severityDistribution: [
    { severity: 'LOW', count: 3 },
    { severity: 'MEDIUM', count: 2 },
    { severity: 'HIGH', count: 2 },
  ],
  submissionTrend: [
    { date: '2026-07-23', count: 0 },
    { date: '2026-07-24', count: 2 },
  ],
  assignmentWorkload: [
    {
      staff: {
        id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
        displayName: 'Amina',
      },
      activeIncidentCount: 3,
    },
  ],
  attachmentReviewWorkload: {
    quarantined: 2,
    available: 3,
    rejected: 1,
  },
  recentActivity: [
    {
      type: 'STATUS_CHANGED',
      occurredAt: '2026-07-24T07:00:00.000Z',
      incident: {
        id: '52fc7e20-ab06-4f7c-8d3c-15f075275fd3',
        internalCaseId: 'GAR-20260724-0001',
      },
      actor: {
        id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
        displayName: 'Amina',
      },
      summary: { fromStatus: 'NEW', toStatus: 'UNDER_REVIEW' },
    },
  ],
} satisfies OperationsDashboard;

const principal = {
  id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
  email: 'staff@example.test',
  name: 'Amina',
  role: 'ADMIN' as const,
};

afterEach(cleanup);

describe('admin operations dashboard web integration', () => {
  it('renders Hausa by default with exact accessible values and workload disclaimer', () => {
    const { container } = render(
      <AdminOperationsDashboard
        locale="ha"
        principal={principal}
        dashboard={dashboard}
        apiBaseUrl="http://localhost:4000/api"
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Allon taƙaitaccen ayyuka' }),
    ).toBeTruthy();
    expect(screen.getByText(/ba ma’aunin ƙwazo/)).toBeTruthy();
    expect(screen.getByRole('table', { name: /Adadin rahotannin/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Buɗe rahoton GAR-/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /jerin rahotannin/i })).toBeTruthy();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('renders independently localized English labels and preserves range in language links', () => {
    render(
      <AdminOperationsDashboard
        locale="en"
        principal={principal}
        dashboard={dashboard}
        apiBaseUrl="http://localhost:4000/api"
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Operations dashboard' })).toBeTruthy();
    expect(screen.getByText('Status distribution')).toBeTruthy();
    expect(screen.getByText('Severity distribution')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Hausa' }).getAttribute('href')).toBe(
      '/admin?lang=ha&range=30d',
    );
    expect(screen.getByRole('link', { name: 'Last 7 days' }).getAttribute('href')).toBe(
      '/admin?lang=en&range=7d',
    );
  });

  it('keeps helper URLs deterministic and defaults unsupported ranges safely', () => {
    expect(dashboardPath('en', '90d')).toBe('/admin?lang=en&range=90d');
    expect(normalizeDashboardRange(undefined)).toBe('30d');
    expect(normalizeDashboardRange('invalid')).toBe('30d');
  });

  it('renders a successful empty state distinctly from dashboard errors', () => {
    render(
      <AdminOperationsDashboard
        locale="en"
        principal={principal}
        dashboard={{
          ...dashboard,
          overview: {
            totalIncidents: 0,
            newIncidents: 0,
            underReviewIncidents: 0,
            unassignedIncidents: 0,
            openIncidents: 0,
            closedIncidents: 0,
            rejectedIncidents: 0,
          },
          assignmentWorkload: [],
          recentActivity: [],
        }}
        apiBaseUrl="http://localhost:4000/api"
      />,
    );
    expect(screen.getByText('No incidents are currently stored.')).toBeTruthy();
    expect(screen.getByText(/No privacy-safe operational activity/)).toBeTruthy();
    expect(screen.getByText(/No active eligible staff workload/)).toBeTruthy();
    expect(screen.queryByText(/could not be loaded/)).toBeNull();
  });

  it('contains server-side authentication and no sensitive analytics or browser storage', () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/app/(default)/admin/page.tsx'),
      'utf8',
    );
    const componentSource = readFileSync(
      resolve(process.cwd(), 'src/components/admin/admin-operations-dashboard.tsx'),
      'utf8',
    );
    expect(pageSource).toContain('await getAdminPrincipal()');
    expect(pageSource).toContain('loadOperationsDashboard(range)');
    expect(`${pageSource}${componentSource}`).not.toMatch(
      /localStorage|sessionStorage|contact data|note body|attachment filename/i,
    );
  });
});
