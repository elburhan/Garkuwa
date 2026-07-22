import { ValidationPipe } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApiHttpHardening } from '../src/config/http-hardening.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Public incident categories endpoint', () => {
  let app: NestExpressApplication;
  const findMany = jest.fn<() => Promise<unknown[]>>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ incidentCategory: { findMany } })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApiHttpHardening(app);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    findMany.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns active public category fields without requiring authentication', async () => {
    findMany.mockResolvedValue([
      {
        id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
        nameHa: 'Wani lamari',
        nameEn: 'Other incident',
        descriptionHa: null,
        descriptionEn: null,
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/public/incident-categories')
      .expect(200);

    expect(response.body).toEqual({
      categories: [
        {
          id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
          nameHa: 'Wani lamari',
          nameEn: 'Other incident',
          descriptionHa: null,
          descriptionEn: null,
        },
      ],
    });
    expect(response.body.categories[0]).not.toHaveProperty('isActive');
    expect(response.body.categories[0]).not.toHaveProperty('displayOrder');
    expect(response.body.categories[0]).not.toHaveProperty('createdAt');
  });
});
