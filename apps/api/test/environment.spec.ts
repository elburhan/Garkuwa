import { parseApiEnvironment } from '../src/config/environment.js';

const baseEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  API_PORT: '4000',
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/garkuwa',
  CONTACT_DATA_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  STAFF_SESSION_COOKIE_SECURE: 'false',
  TRUST_PROXY: 'false',
  INCIDENT_STORAGE_DRIVER: 'filesystem',
  INCIDENT_STORAGE_FILESYSTEM_ROOT: '.var/test-uploads',
  NEWSROOM_MEDIA_FILESYSTEM_ROOT: '.var/test-newsroom-media',
};

describe('API environment validation', () => {
  it('allows the explicit local development profile', () => {
    expect(parseApiEnvironment(baseEnvironment)).toMatchObject({
      NODE_ENV: 'development',
      STAFF_SESSION_COOKIE_SECURE: false,
      TRUST_PROXY: 'false',
      INCIDENT_STORAGE_DRIVER: 'filesystem',
    });
  });

  it('rejects insecure cookies, origins, and filesystem storage in production', () => {
    expect(() =>
      parseApiEnvironment({
        ...baseEnvironment,
        NODE_ENV: 'production',
      }),
    ).toThrow(/STAFF_SESSION_COOKIE_SECURE|WEB_ORIGIN|INCIDENT_STORAGE_DRIVER/);
  });

  it('accepts a complete private S3 production profile', () => {
    expect(
      parseApiEnvironment({
        ...baseEnvironment,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:nonplaceholder@db.example.invalid:5432/garkuwa',
        CONTACT_DATA_ENCRYPTION_KEY: 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=',
        WEB_ORIGIN: 'https://www.example.invalid',
        STAFF_SESSION_COOKIE_SECURE: 'true',
        TRUST_PROXY: 'loopback',
        INCIDENT_STORAGE_DRIVER: 's3',
        S3_ENDPOINT: 'https://storage.example.invalid',
        S3_REGION: 'us-east-1',
        S3_BUCKET: 'garkuwa-private-incidents',
        S3_ACCESS_KEY_ID: 'fake-access-for-validation',
        S3_SECRET_ACCESS_KEY: 'fake-secret-for-validation',
      }),
    ).toMatchObject({
      NODE_ENV: 'production',
      INCIDENT_STORAGE_DRIVER: 's3',
      STAFF_SESSION_COOKIE_SECURE: true,
    });
  });

  it('reports invalid keys without echoing their secret values', () => {
    const secret = 'not-a-valid-secret-value';
    expect(() =>
      parseApiEnvironment({
        ...baseEnvironment,
        CONTACT_DATA_ENCRYPTION_KEY: secret,
      }),
    ).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(secret),
      }),
    );
  });
});
