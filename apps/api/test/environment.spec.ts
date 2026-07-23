import { getApiEnvironment } from '../src/config/environment.js';

describe('API authentication environment', () => {
  const originalNodeEnvironment = process.env.NODE_ENV;
  const originalCookieSecure = process.env.STAFF_SESSION_COOKIE_SECURE;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnvironment;
    process.env.STAFF_SESSION_COOKIE_SECURE = originalCookieSecure;
  });

  it('requires a Secure staff session cookie in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.STAFF_SESSION_COOKIE_SECURE = 'false';

    expect(() => getApiEnvironment()).toThrow(
      /must be true when NODE_ENV is production[\s\S]*STAFF_SESSION_COOKIE_SECURE/,
    );
  });

  it('allows an insecure cookie only outside production for local HTTP development', () => {
    process.env.NODE_ENV = 'development';
    process.env.STAFF_SESSION_COOKIE_SECURE = 'false';

    expect(getApiEnvironment().STAFF_SESSION_COOKIE_SECURE).toBe(false);
  });
});
