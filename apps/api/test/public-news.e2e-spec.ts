import { ValidationPipe } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApiHttpHardening } from '../src/config/http-hardening.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { IncidentCategoriesService } from '../src/modules/incidents/incident-categories.service.js';
import { PublicNewsService } from '../src/modules/news/public/public-news.service.js';

const publicArticle = {
  slug: 'sanarwar-tsaro',
  title: 'Sanarwar Tsaro',
  summary: 'Taƙaitaccen bayanin sanarwar jama’a.',
  body: 'Sakin layi na farko.\n\nSakin layi na biyu.',
  publishedAt: '2026-07-29T10:00:00.000Z',
  hasEnglishTranslation: true,
};

describe('public news HTTP endpoints', () => {
  let app: NestExpressApplication;
  const service = {
    list: jest.fn(async () => ({
      items: [publicArticle],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    })),
    detail: jest.fn(async () => publicArticle),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(PublicNewsService)
      .useValue(service)
      .overrideProvider(IncidentCategoriesService)
      .useValue({ findActive: jest.fn(async () => []) })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApiHttpHardening(app);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('allows unauthenticated cached list access with strict bounded pagination', async () => {
    const response = await request(app.getHttpServer()).get('/api/public/news').expect(200);
    expect(response.headers['cache-control']).toBe(
      'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
    );
    expect(service.list).toHaveBeenCalledWith({ lang: 'ha', page: 1, pageSize: 10 });
    await request(app.getHttpServer()).get('/api/public/news?pageSize=31').expect(400);
    await request(app.getHttpServer()).get('/api/public/news?page=-1').expect(400);
    await request(app.getHttpServer()).get('/api/public/news?unknown=true').expect(400);
  });

  it('returns strict localized detail without authentication or internal metadata', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/news/sanarwar-tsaro?lang=en')
      .expect(200);
    expect(service.detail).toHaveBeenCalledWith('sanarwar-tsaro', 'en');
    expect(response.body).toEqual(publicArticle);
    expect(response.text).not.toMatch(
      /status|author|staff|createdAt|updatedAt|history|reason|password|session|token|"id"/i,
    );
    await request(app.getHttpServer()).get('/api/public/news/INVALID SLUG').expect(400);
    await request(app.getHttpServer()).get('/api/public/news/sanarwar-tsaro?lang=fr').expect(400);
  });

  it('does not weaken protected admin news or existing public endpoints', async () => {
    await request(app.getHttpServer()).get('/api/admin/news').expect(401);
    await request(app.getHttpServer()).get('/api/health').expect(200);
    await request(app.getHttpServer()).get('/api/public/incident-categories').expect(200);
  });
});
