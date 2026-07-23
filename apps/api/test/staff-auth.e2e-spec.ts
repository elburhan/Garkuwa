import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApiHttpHardening } from '../src/config/http-hardening.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { StaffRole } from '../src/generated/prisma/enums.js';
import { StaffAuthenticationService } from '../src/modules/auth/staff-authentication.service.js';
import type { StaffLoginResult } from '../src/modules/auth/staff-authentication.service.js';
import type { StaffLoginDto } from '../src/modules/auth/staff-auth.dto.js';
import type { StaffPrincipal } from '../src/modules/auth/auth.types.js';
import { STAFF_SESSION_COOKIE_NAME } from '../src/modules/auth/auth.constants.js';
import { StaffLoginRateLimitGuard } from '../src/modules/auth/staff-login-rate-limit.guard.js';
import { StaffSessionService } from '../src/modules/auth/staff-session.service.js';

const origin = 'http://localhost:3000';
const principal = {
  id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
  email: 'staff@example.test',
  name: 'Test Staff',
  role: StaffRole.MODERATOR,
};

describe('staff authentication endpoints', () => {
  let app: NestExpressApplication;
  let rateLimit: StaffLoginRateLimitGuard;
  const login = jest.fn<(input: StaffLoginDto) => Promise<StaffLoginResult>>();
  const authenticate = jest.fn<(token: string) => Promise<StaffPrincipal | null>>();
  const revoke = jest.fn<(token: string) => Promise<void>>();
  const findManyCategories = jest.fn<() => Promise<unknown[]>>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ incidentCategory: { findMany: findManyCategories } })
      .overrideProvider(StaffAuthenticationService)
      .useValue({ login })
      .overrideProvider(StaffSessionService)
      .useValue({ authenticate, revoke })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApiHttpHardening(app);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true }),
    );
    app.enableCors({ origin, credentials: true });
    await app.init();
    rateLimit = app.get(StaffLoginRateLimitGuard);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimit.reset();
    process.env.STAFF_SESSION_COOKIE_SECURE = 'false';
    login.mockResolvedValue({ token: 'fake-opaque-token', user: principal });
    authenticate.mockResolvedValue(principal);
    revoke.mockResolvedValue(undefined);
    findManyCategories.mockResolvedValue([]);
  });

  afterAll(async () => app.close());

  it('sets an HttpOnly, SameSite=Lax, root-path cookie without exposing its token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/staff/login')
      .set('Origin', origin)
      .send({ email: ' STAFF@EXAMPLE.TEST ', password: 'Fake-development-password-42!' })
      .expect(200);

    expect(login).toHaveBeenCalledWith({
      email: 'staff@example.test',
      password: 'Fake-development-password-42!',
    });
    expect(response.body).toEqual({ authenticated: true, user: principal });
    expect(response.text).not.toContain('fake-opaque-token');
    const cookie = (response.headers['set-cookie'] as unknown as string[] | undefined)?.[0];
    expect(cookie).toBeDefined();
    expect(cookie!).toContain(`${STAFF_SESSION_COOKIE_NAME}=`);
    expect(cookie!).toContain('HttpOnly');
    expect(cookie!).toContain('SameSite=Lax');
    expect(cookie!).toContain('Path=/');
    expect(cookie!).not.toContain('Secure');
  });

  it('marks the session cookie Secure when production-style configuration requires it', async () => {
    process.env.STAFF_SESSION_COOKIE_SECURE = 'true';
    const response = await request(app.getHttpServer())
      .post('/api/auth/staff/login')
      .set('Origin', origin)
      .send({ email: 'staff@example.test', password: 'Fake-development-password-42!' })
      .expect(200);
    expect((response.headers['set-cookie'] as unknown as string[] | undefined)?.[0]).toContain(
      'Secure',
    );
  });

  it('requires JSON and rejects an untrusted or missing origin', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/staff/login')
      .set('Origin', origin)
      .set('Content-Type', 'text/plain')
      .send('credentials')
      .expect(415);
    await request(app.getHttpServer())
      .post('/api/auth/staff/login')
      .set('Origin', 'https://untrusted.example')
      .send({ email: 'staff@example.test', password: 'Fake-development-password-42!' })
      .expect(403);
    await request(app.getHttpServer()).post('/api/auth/staff/logout').expect(403);
  });

  it('returns a generic invalid-credentials response', async () => {
    login.mockRejectedValueOnce(new UnauthorizedException('Invalid email or password.'));

    const response = await request(app.getHttpServer())
      .post('/api/auth/staff/login')
      .set('Origin', origin)
      .send({ email: 'unknown@example.test', password: 'Wrong-password-value-42!' })
      .expect(401);

    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Invalid email or password.',
      error: 'Unauthorized',
    });
    expect(response.text).not.toContain('unknown@example.test');
  });

  it('requires a valid session for /me and returns only the principal', async () => {
    await request(app.getHttpServer()).get('/api/auth/staff/me').expect(401);
    const response = await request(app.getHttpServer())
      .get('/api/auth/staff/me')
      .set('Cookie', `${STAFF_SESSION_COOKIE_NAME}=fake-opaque-token`)
      .expect(200);
    expect(response.body).toEqual({ authenticated: true, user: principal });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('token');
  });

  it('revokes logout sessions, clears the cookie, and remains idempotent', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/staff/logout')
      .set('Origin', origin)
      .set('Cookie', `${STAFF_SESSION_COOKIE_NAME}=fake-opaque-token`)
      .expect(200);
    expect(revoke).toHaveBeenCalledWith('fake-opaque-token');
    const clearedCookie = (response.headers['set-cookie'] as unknown as string[] | undefined)?.[0];
    expect(clearedCookie).toContain(`${STAFF_SESSION_COOKIE_NAME}=`);
    expect(clearedCookie).toContain('Expires=Thu, 01 Jan 1970');

    await request(app.getHttpServer())
      .post('/api/auth/staff/logout')
      .set('Origin', origin)
      .expect(200);
  });

  it('rate limits the sixth login request from one client', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/staff/login')
        .set('Origin', origin)
        .send({ email: 'staff@example.test', password: 'Fake-development-password-42!' })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post('/api/auth/staff/login')
      .set('Origin', origin)
      .send({ email: 'staff@example.test', password: 'Fake-development-password-42!' })
      .expect(429);
  });

  it('leaves health and public incident routes unprotected', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
    await request(app.getHttpServer()).get('/api/public/incident-categories').expect(200);
    await request(app.getHttpServer()).post('/api/public/incidents').send({}).expect(400);
  });
});
