import { describe, expect, it, vi } from 'vitest';

import {
  loadIncidentCategories,
  PublicApiError,
  submitIncidentReport,
} from '../src/lib/public-api';

const category = {
  id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
  nameHa: 'Wani lamari',
  nameEn: 'Other incident',
  descriptionHa: null,
  descriptionEn: null,
};

describe('public API client', () => {
  it('normalizes the base URL and parses public categories', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ categories: [category] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      loadIncidentCategories('http://localhost:4000/api/', { fetcher }),
    ).resolves.toEqual([category]);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:4000/api/public/incident-categories',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('maps rate limiting to a safe error without reading the response body', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('sensitive internal response', { status: 429 }));

    await expect(
      submitIncidentReport(
        'http://localhost:4000/api',
        {
          categoryId: category.id,
          description: 'A sufficiently detailed incident description.',
          severity: 'MEDIUM',
          submissionLanguage: 'en',
        },
        { fetcher },
      ),
    ).rejects.toEqual(new PublicApiError('rate-limit'));
  });
});
