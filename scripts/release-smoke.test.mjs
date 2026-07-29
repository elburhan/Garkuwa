import assert from 'node:assert/strict';
import test from 'node:test';

import { createSmokeChecks, runSmoke } from './release-smoke.mjs';

const silentLogger = { log() {}, error() {} };

test('a successful non-destructive smoke run exits zero', async () => {
  const methods = [];
  const result = await runSmoke({
    apiBaseUrl: 'https://api.example.org/api',
    webBaseUrl: 'https://www.example.org',
    timeoutMs: 1_000,
    fetchImplementation: async (_url, options) => {
      methods.push(options.method);
      return { status: 200 };
    },
    logger: silentLogger,
  });

  assert.equal(result, 0);
  assert.deepEqual(new Set(methods), new Set(['GET']));
});

test('a failed endpoint produces a non-zero result', async () => {
  const result = await runSmoke({
    apiBaseUrl: 'https://api.example.org/api',
    webBaseUrl: 'https://www.example.org',
    timeoutMs: 1_000,
    fetchImplementation: async (url) => ({ status: url.endsWith('/health/ready') ? 503 : 200 }),
    logger: silentLogger,
  });

  assert.equal(result, 1);
});

test('a request timeout is handled without exposing a response body', async () => {
  const errors = [];
  const result = await runSmoke({
    apiBaseUrl: 'https://api.example.org/api',
    webBaseUrl: 'https://www.example.org',
    timeoutMs: 1_000,
    fetchImplementation: async () => {
      throw new DOMException('request timed out', 'TimeoutError');
    },
    logger: {
      log() {},
      error(message) {
        errors.push(message);
      },
    },
  });

  assert.equal(result, 1);
  assert.ok(errors.every((message) => message.includes('request timed out')));
});

test('the smoke inventory contains only public read-only paths', () => {
  const checks = createSmokeChecks('https://api.example.org/api', 'https://www.example.org');
  assert.ok(checks.length > 0);
  assert.ok(checks.every(({ url }) => new URL(url).protocol === 'https:'));
  assert.ok(checks.every(({ url }) => !/logout|submit|upload|mutation/i.test(url)));
});
