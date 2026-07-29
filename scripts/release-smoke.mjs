import { pathToFileURL } from 'node:url';

export function createSmokeChecks(apiBaseUrlInput, webBaseUrlInput) {
  const apiBaseUrl = apiBaseUrlInput.replace(/\/$/, '');
  const webBaseUrl = webBaseUrlInput.replace(/\/$/, '');

  return [
    { name: 'API liveness', url: `${apiBaseUrl}/health/live`, status: 200 },
    { name: 'API readiness', url: `${apiBaseUrl}/health/ready`, status: 200 },
    { name: 'Hausa homepage', url: `${webBaseUrl}/`, status: 200 },
    { name: 'English homepage', url: `${webBaseUrl}/en`, status: 200 },
    { name: 'Hausa news', url: `${webBaseUrl}/news`, status: 200 },
    { name: 'English news', url: `${webBaseUrl}/en/news`, status: 200 },
    { name: 'Live updates', url: `${webBaseUrl}/news/live`, status: 200 },
    { name: 'Security advisories', url: `${webBaseUrl}/news/security`, status: 200 },
    { name: 'Hausa incident report', url: `${webBaseUrl}/rahoton-lamari`, status: 200 },
    { name: 'English incident report', url: `${webBaseUrl}/en/report-incident`, status: 200 },
    { name: 'About', url: `${webBaseUrl}/about`, status: 200 },
    { name: 'FAQ', url: `${webBaseUrl}/faq`, status: 200 },
    { name: 'Help', url: `${webBaseUrl}/help`, status: 200 },
    { name: 'Contact', url: `${webBaseUrl}/contact`, status: 200 },
    { name: 'Safety guidance', url: `${webBaseUrl}/safety`, status: 200 },
    { name: 'Admin login', url: `${webBaseUrl}/admin/login`, status: 200 },
  ];
}

export async function runSmoke({
  apiBaseUrl,
  webBaseUrl,
  timeoutMs,
  fetchImplementation = fetch,
  logger = console,
}) {
  let failed = false;

  for (const check of createSmokeChecks(apiBaseUrl, webBaseUrl)) {
    try {
      const response = await fetchImplementation(check.url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      const passed = response.status === check.status;
      logger.log(`${passed ? 'PASS' : 'FAIL'} ${check.name}: HTTP ${response.status}`);
      failed ||= !passed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'request failed';
      logger.error(`FAIL ${check.name}: ${message}`);
      failed = true;
    }
  }

  return failed ? 1 : 0;
}

async function main() {
  const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 10_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
    console.error('SMOKE_TIMEOUT_MS must be an integer between 100 and 60000.');
    return 1;
  }

  return runSmoke({
    apiBaseUrl: process.env.SMOKE_API_BASE_URL ?? 'http://localhost:4000/api',
    webBaseUrl: process.env.SMOKE_WEB_BASE_URL ?? 'http://localhost:3000',
    timeoutMs,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
