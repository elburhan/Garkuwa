import { HealthService } from '../src/health/health.service.js';

describe('HealthService', () => {
  it('returns the service health', () => {
    const result = new HealthService().getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('garkuwa-api');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
