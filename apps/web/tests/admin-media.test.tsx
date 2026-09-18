// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminMediaLibrary } from '../src/components/admin/admin-media-library';
import type { AdminPrincipal } from '../src/lib/admin-auth';
import type { AdminMediaList } from '../src/lib/admin-media-api';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../src/lib/env', () => ({
  webEnvironment: { NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api' },
}));

const media: AdminMediaList = {
  items: [
    {
      id: '52fc7e20-ab06-4f7c-8d3c-15f075275fd3',
      originalFilename: 'editorial-photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      width: 640,
      height: 360,
      mediaType: 'IMAGE',
      status: 'ACTIVE',
      provenance: 'STAFF',
      altTextHa: 'Hoton gwajin sashen labarai',
      altTextEn: null,
      captionHa: 'Bayanin hoton gwaji',
      captionEn: null,
      credit: 'Hoton ma’aikaci',
      source: 'Ma’aikaci',
      rightsNotes: null,
      createdAt: '2026-09-15T10:00:00.000Z',
      updatedAt: '2026-09-15T10:00:00.000Z',
      uploadedBy: { id: 'staff-id', displayName: 'Ma’aikacin Gwaji' },
    },
  ],
  pagination: { page: 1, pageSize: 24, totalItems: 1, totalPages: 1 },
};

function principal(role: AdminPrincipal['role']): AdminPrincipal {
  return { id: 'staff-id', email: 'staff@example.test', name: 'Staff', role };
}

afterEach(cleanup);

describe('admin newsroom media library', () => {
  it('renders a mobile-friendly Hausa upload and editorial-only media card', () => {
    render(<AdminMediaLibrary locale="ha" principal={principal('EDITOR')} media={media} />);
    expect(screen.getByLabelText('Fayil ɗin hoto').getAttribute('accept')).toBe(
      'image/jpeg,image/png,image/webp',
    );
    expect(screen.getByAltText('Hoton gwajin sashen labarai')).toBeTruthy();
    expect(screen.queryByText(/incident|sha256|storageKey|objectKey/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ajiye a tarihi' })).toBeNull();
  });

  it('shows metadata editing to moderators and archive only to administrators', () => {
    const { rerender } = render(
      <AdminMediaLibrary locale="en" principal={principal('MODERATOR')} media={media} />,
    );
    expect(screen.getByText('Edit details')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    rerender(<AdminMediaLibrary locale="en" principal={principal('ADMIN')} media={media} />);
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy();
  });
});
