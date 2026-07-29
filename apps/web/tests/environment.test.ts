import { beforeAll, describe, expect, it } from 'vitest';

let parseWebEnvironment: (input: NodeJS.ProcessEnv) => { NODE_ENV: string };

beforeAll(async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  ({ parseWebEnvironment } = await import('../src/lib/env.js'));
});

describe('web environment validation', () => {
  it('accepts local HTTP in development', () => {
    expect(
      parseWebEnvironment({
        NODE_ENV: 'development',
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api',
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      }),
    ).toMatchObject({ NODE_ENV: 'development' });
  });

  it('requires HTTPS URLs for production by default', () => {
    expect(() =>
      parseWebEnvironment({
        NODE_ENV: 'production',
        DEPLOYMENT_ENV: 'production',
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api',
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      }),
    ).toThrow(/must use HTTPS/);
  });

  it('accepts HTTPS production URLs', () => {
    expect(
      parseWebEnvironment({
        NODE_ENV: 'production',
        DEPLOYMENT_ENV: 'production',
        NEXT_PUBLIC_API_BASE_URL: 'https://api.example.invalid/api',
        NEXT_PUBLIC_APP_URL: 'https://www.example.invalid',
      }),
    ).toMatchObject({ NODE_ENV: 'production' });
  });
});
