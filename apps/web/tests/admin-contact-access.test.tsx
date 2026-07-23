// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminContactAccessPanel } from '../src/components/admin/admin-contact-access-panel';
import { AdminIncidentDetailView } from '../src/components/admin/admin-incident-detail';
import type { AdminIncidentDetail } from '../src/lib/admin-incidents-api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock('../src/lib/env', () => ({
  webEnvironment: {
    NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const detail = {
  id: incidentId,
  internalCaseId: 'GAR-20260723-0001',
  category: {
    id: 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0',
    nameHa: 'Tsaro',
    nameEn: 'Safety',
  },
  status: 'NEW',
  severity: 'MEDIUM',
  submissionLanguage: 'ha',
  state: null,
  lga: null,
  locationDescription: null,
  incidentDate: null,
  submittedAt: '2026-07-23T12:00:00.000Z',
  assignedTo: null,
  description: 'Fake incident description.',
  incidentTime: null,
  latitude: null,
  longitude: null,
  duplicateOfIncidentId: null,
  updatedAt: '2026-07-23T12:00:00.000Z',
  closedAt: null,
  statusHistory: [],
  assignmentHistory: [],
} satisfies AdminIncidentDetail;

const revealResponse = {
  contact: {
    name: 'Fake Person',
    phone: '+2340000000000',
    email: null,
    preferredContactMethod: 'PHONE',
    safeContactInstructions: 'Weekdays only',
    consentToContact: true,
  },
  access: { accessedAt: '2026-07-23T14:00:00.000Z' },
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('restricted admin contact access', () => {
  it('renders the panel only for SUPER_ADMIN and ADMIN roles', () => {
    const { rerender } = render(
      <AdminIncidentDetailView locale="en" incident={detail} role="MODERATOR" />,
    );
    expect(screen.queryByRole('heading', { name: 'Restricted contact information' })).toBeNull();
    rerender(<AdminIncidentDetailView locale="en" incident={detail} role="ANALYST" />);
    expect(screen.queryByRole('heading', { name: 'Restricted contact information' })).toBeNull();
    rerender(<AdminIncidentDetailView locale="en" incident={detail} role="ADMIN" />);
    expect(screen.getByRole('heading', { name: 'Restricted contact information' })).toBeTruthy();
    rerender(<AdminIncidentDetailView locale="en" incident={detail} role="SUPER_ADMIN" />);
    expect(screen.getByRole('heading', { name: 'Restricted contact information' })).toBeTruthy();
  });

  it('requires a reason and acknowledgement before revealing, then manually hides data', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(revealResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(<AdminContactAccessPanel locale="en" incidentId={incidentId} history={[]} />);
    expect(document.body.textContent).not.toContain('Fake Person');

    await user.click(screen.getByRole('button', { name: 'Reveal contact information' }));
    expect(screen.getByText(/Enter 10 to 1000/i)).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Reason for access'), 'Approved official follow-up');
    await user.click(screen.getByRole('button', { name: 'Reveal contact information' }));
    expect(screen.getByText(/Confirm the access acknowledgement/i)).toBeTruthy();

    await user.click(screen.getByLabelText(/I understand that access is recorded/i));
    await user.click(screen.getByRole('button', { name: 'Reveal contact information' }));
    expect(await screen.findByText('Fake Person')).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/admin/incidents/${incidentId}/contact-access`),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Hide contact information' }));
    expect(screen.queryByText('Fake Person')).toBeNull();
    expect(screen.getByText('Contact information has been hidden.')).toBeTruthy();
  });

  it('automatically clears revealed data after two minutes and renders safe audit history', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(revealResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(
      <AdminContactAccessPanel
        locale="en"
        incidentId={incidentId}
        history={[
          {
            id: '7915f2ef-67da-45ac-b577-5d5c573afca5',
            reason: 'Approved official follow-up',
            accessedAt: '2026-07-23T14:00:00.000Z',
            accessedBy: { id: incidentId, displayName: 'Administrator' },
          },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Reason for access'), {
      target: { value: 'Approved official follow-up' },
    });
    fireEvent.click(screen.getByLabelText(/I understand that access is recorded/i));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reveal contact information' }));
    });
    expect(screen.getByText('Fake Person')).toBeTruthy();
    expect(screen.getByText('Administrator')).toBeTruthy();
    expect(document.body.textContent).not.toContain('+2340000000000Administrator');

    act(() => vi.advanceTimersByTime(120_000));
    expect(screen.queryByText('Fake Person')).toBeNull();
    expect(screen.getByText(/hidden automatically after two minutes/i)).toBeTruthy();
  });

  it('maps rate-limit responses to a safe localized message', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 429 }));
    render(<AdminContactAccessPanel locale="en" incidentId={incidentId} history={[]} />);
    await user.type(screen.getByLabelText('Reason for access'), 'Approved official follow-up');
    await user.click(screen.getByLabelText(/I understand that access is recorded/i));
    await user.click(screen.getByRole('button', { name: 'Reveal contact information' }));
    expect(await screen.findByText(/Too many access attempts/i)).toBeTruthy();
    expect(document.body.textContent).not.toContain('Fake Person');
  });

  it('uses memory-only, non-cached access without export or clipboard behavior', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/admin-contact-access-api.ts'),
      'utf8',
    );
    const panel = readFileSync(
      resolve(process.cwd(), 'src/components/admin/admin-contact-access-panel.tsx'),
      'utf8',
    );
    expect(source).toContain("credentials: 'include'");
    expect(source).toContain("cache: 'no-store'");
    expect(`${source}${panel}`).not.toContain('localStorage');
    expect(`${source}${panel}`).not.toContain('sessionStorage');
    expect(`${source}${panel}`).not.toContain('clipboard');
    expect(`${source}${panel}`).not.toContain('download=');
    expect(`${source}${panel}`).not.toContain('navigator.clipboard');
  });
});
