import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
});

import { loadPublicInstitutionalPage } from '../src/lib/public-institutional-content-api';

describe('public institutional content integration', () => {
  it('loads a narrow published Hausa response', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          key: 'ABOUT',
          title: 'Game da Dandalin Garkuwa',
          summary: 'Bayani mai taƙaitawa.',
          sections: [
            {
              sectionKey: 'mission',
              heading: 'Manufa',
              body: 'Wannan cikakken rubutu ne na sashe domin gwajin shafin.',
            },
          ],
          publishedAt: '2026-07-29T10:00:00.000Z',
          hasEnglishTranslation: true,
        }),
        { status: 200 },
      ),
    );
    const result = await loadPublicInstitutionalPage('ABOUT', 'ha', fetcher);
    expect(result.kind).toBe('success');
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/public/institutional-pages/ABOUT?lang=ha'),
      expect.objectContaining({ next: { revalidate: 60 } }),
    );
  });

  it('distinguishes an incomplete English 404 from API unavailability', async () => {
    await expect(
      loadPublicInstitutionalPage(
        'ABOUT',
        'en',
        vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      ),
    ).resolves.toEqual({ kind: 'not-found' });
    await expect(
      loadPublicInstitutionalPage('ABOUT', 'ha', vi.fn().mockRejectedValue(new Error('offline'))),
    ).resolves.toEqual({ kind: 'unavailable' });
  });

  it('uses plain text rendering and no browser draft persistence', () => {
    const publicComponent = readFileSync(
      resolve(process.cwd(), 'src/components/public/informational-pages.tsx'),
      'utf8',
    );
    const editor = readFileSync(
      resolve(process.cwd(), 'src/components/admin/admin-institutional-content-editor.tsx'),
      'utf8',
    );
    expect(publicComponent).not.toContain('dangerouslySetInnerHTML');
    expect(publicComponent).not.toContain('Markdown');
    expect(editor).not.toContain('localStorage');
    expect(editor).not.toContain('sessionStorage');
    expect(editor).not.toContain('contentEditable');
  });
});
