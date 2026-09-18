// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicLiveUpdate } from '@garkuwa/contracts/live';

import { AdminLiveDetail } from '@/components/admin/admin-live-detail';
import { PublicLiveEvent } from '@/components/public/public-live-event';
import { PublicLiveTimeline } from '@/components/public/public-live-timeline';

const { loadIncrementalLiveUpdates } = vi.hoisted(() => ({
  loadIncrementalLiveUpdates: vi.fn(),
}));
vi.mock('@/lib/env', () => ({
  webEnvironment: {
    NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => cleanup());
vi.mock('@/lib/public-live-api', () => ({ loadIncrementalLiveUpdates }));

const firstUpdate = {
  id: '11111111-1111-4111-8111-111111111111',
  sequence: 1,
  headline: 'Sabon bayani',
  body: 'An tabbatar da sabon bayani.',
  isPinned: true,
  isWithdrawn: false,
  createdAt: '2026-09-18T10:00:00.000Z',
  updatedAt: '2026-09-18T10:00:00.000Z',
  correctedAt: null,
  media: {
    id: '22222222-2222-4222-8222-222222222222',
    url: '/api/public/news/media/22222222-2222-4222-8222-222222222222',
    mimeType: 'image/png',
    width: 640,
    height: 360,
    altText: 'Hoton gwaji',
    caption: null,
    credit: null,
  },
} satisfies PublicLiveUpdate;

describe('Phase 4 public live coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders Hausa live status, safe media, stable anchors, and sharing controls', () => {
    render(
      <PublicLiveEvent
        locale="ha"
        event={{
          slug: 'gwajin-kai-tsaye',
          title: 'Rahoto kai tsaye',
          summary: 'Taƙaitaccen bayani.',
          status: 'ACTIVE',
          isFeatured: true,
          hasEnglishTranslation: false,
          startedAt: '2026-09-18T09:00:00.000Z',
          closedAt: null,
          updatedAt: '2026-09-18T10:00:00.000Z',
          latestUpdateAt: '2026-09-18T10:00:00.000Z',
          updateCount: 1,
          category: { slug: 'news', name: 'Labarai' },
          featuredMedia: null,
          updates: [firstUpdate],
          latestSequence: 1,
          oldestSequence: 1,
          hasOlder: false,
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Rahoto kai tsaye' })).toBeTruthy();
    expect(document.querySelector('#update-1')).toBeTruthy();
    expect(screen.getByText('Muhimmin sabuntawa')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Hoton gwaji' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kwafi mahaɗi' })).toBeTruthy();
  });

  it('queues newly polled updates without moving a reader who scrolled down', async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
    loadIncrementalLiveUpdates.mockResolvedValue({
      kind: 'success',
      data: {
        generatedAt: '2026-09-18T10:01:00.000Z',
        latestSequence: 2,
        hasMore: false,
        updates: [{ ...firstUpdate, id: '33333333-3333-4333-8333-333333333333', sequence: 2 }],
      },
    });
    render(
      <PublicLiveTimeline
        slug="gwajin-kai-tsaye"
        locale="ha"
        initialUpdates={[firstUpdate]}
        initialLatestSequence={1}
        initialHasOlder={false}
        initialCheckedAt="2026-09-18T10:00:00.000Z"
      />,
    );
    await act(async () => vi.advanceTimersByTimeAsync(12_000));
    expect(screen.getByRole('button', { name: '1 sabbin sabuntawa' })).toBeTruthy();
    expect(window.scrollY).toBe(500);
  });
});

describe('Phase 4 admin live controls', () => {
  const adminUpdate = {
    id: '66666666-6666-4666-8666-666666666666',
    sequence: 1,
    headlineHa: 'Sabuntawa',
    headlineEn: null,
    bodyHa: 'Bayanan gwaji',
    bodyEn: null,
    isRetracted: false,
    isPinned: false,
    correctedAt: null,
    withdrawnAt: null,
    withdrawalReason: null,
    mediaId: null,
    createdAt: '2026-09-18T10:00:00.000Z',
    updatedAt: '2026-09-18T10:00:00.000Z',
    createdBy: { id: '55555555-5555-4555-8555-555555555555', displayName: 'Edita' },
    revisions: [],
  };
  const detail = {
    event: {
      id: '44444444-4444-4444-8444-444444444444',
      slug: 'gwaji',
      titleHa: 'Gwaji',
      titleEn: null,
      summaryHa: null,
      summaryEn: null,
      status: 'ACTIVE' as const,
      isFeatured: false,
      startedAt: '2026-09-18T09:00:00.000Z',
      closedAt: null,
      createdAt: '2026-09-18T08:00:00.000Z',
      updatedAt: '2026-09-18T10:00:00.000Z',
      category: { code: 'NEWS', slug: 'news', nameHa: 'Labarai', nameEn: 'News' },
      featuredMediaId: null,
      createdBy: { id: '55555555-5555-4555-8555-555555555555', displayName: 'Edita' },
    },
    updates: [adminUpdate],
    operations: [],
  };

  it('shows the simple composer and lifecycle controls to authorized staff', () => {
    render(
      <AdminLiveDetail
        locale="ha"
        detail={detail}
        canPostUpdates
        canPublish
        canEditMetadata
        media={[]}
      />,
    );
    expect(screen.getByRole('group', { name: 'Ƙara sabuntawa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aika sabuntawa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rufe rufe rahoto' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tsare a matsayin muhimmi' })).toBeTruthy();
    expect(screen.getAllByText('Gyara')).toHaveLength(2);
    expect(screen.getAllByText('Janye')).toHaveLength(2);
  });

  it('does not show mutation controls to a read-only viewer', () => {
    render(
      <AdminLiveDetail
        locale="en"
        detail={detail}
        canPostUpdates={false}
        canPublish={false}
        canEditMetadata={false}
        media={[]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Post update' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close coverage' })).toBeNull();
  });
});
