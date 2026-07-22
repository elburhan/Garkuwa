import { describe, expect, it } from 'vitest';

describe('incident report metadata', () => {
  it('uses the canonical Hausa and English alternate route pair', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api';
    const { createPublicMetadata } = await import('../src/lib/public-metadata');

    const ha = createPublicMetadata('ha', 'reportIncident');
    const en = createPublicMetadata('en', 'reportIncident');

    expect(ha.alternates).toMatchObject({
      canonical: 'http://localhost:3000/rahoton-lamari',
      languages: {
        ha: 'http://localhost:3000/rahoton-lamari',
        en: 'http://localhost:3000/en/report-incident',
      },
    });
    expect(en.alternates).toMatchObject({
      canonical: 'http://localhost:3000/en/report-incident',
      languages: {
        ha: 'http://localhost:3000/rahoton-lamari',
        en: 'http://localhost:3000/en/report-incident',
      },
    });
  });
});
