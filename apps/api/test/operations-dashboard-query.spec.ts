import { calculateDashboardRange } from '../src/modules/dashboard/admin-operations-dashboard.service.js';
import { operationsDashboardQuerySchema } from '../src/modules/dashboard/dto/operations-dashboard-query.dto.js';

describe('operations dashboard query validation', () => {
  it('defaults to 30d and accepts only approved ranges', () => {
    expect(operationsDashboardQuerySchema.parse({})).toEqual({ range: '30d' });
    for (const range of ['7d', '30d', '90d']) {
      expect(operationsDashboardQuerySchema.parse({ range })).toEqual({ range });
    }
    expect(operationsDashboardQuerySchema.safeParse({ range: '365d' }).success).toBe(false);
    expect(
      operationsDashboardQuerySchema.safeParse({
        range: '30d',
        unknown: true,
      }).success,
    ).toBe(false);
  });

  it('calculates exact trailing UTC calendar-day ranges deterministically', () => {
    const now = new Date('2026-07-24T08:00:00.000Z');
    const seven = calculateDashboardRange('7d', now);
    expect(seven.from.toISOString()).toBe('2026-07-18T00:00:00.000Z');
    expect(seven.to).toEqual(now);
    expect(seven.dates).toHaveLength(7);
    expect(seven.dates[0]).toBe('2026-07-18');
    expect(seven.dates.at(-1)).toBe('2026-07-24');

    expect(calculateDashboardRange('30d', now).dates).toHaveLength(30);
    expect(calculateDashboardRange('90d', now).dates).toHaveLength(90);
  });
});
