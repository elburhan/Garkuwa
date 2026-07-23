import {
  incidentIdParamSchema,
  listAdminIncidentsQuerySchema,
} from '../src/modules/incidents/admin/dto/admin-incidents.dto.js';

describe('admin incident request validation', () => {
  it('applies safe pagination and sort defaults', () => {
    expect(listAdminIncidentsQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      sort: 'newest',
    });
  });

  it('enforces the maximum page size and exact enums', () => {
    expect(listAdminIncidentsQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(listAdminIncidentsQuerySchema.safeParse({ status: 'PENDING' }).success).toBe(false);
  });

  it('rejects invalid or reversed date ranges and unknown parameters', () => {
    expect(
      listAdminIncidentsQuerySchema.safeParse({
        dateFrom: '2026-07-20',
        dateTo: '2026-07-19',
      }).success,
    ).toBe(false);
    expect(listAdminIncidentsQuerySchema.safeParse({ dateFrom: '2026-02-30' }).success).toBe(false);
    expect(listAdminIncidentsQuerySchema.safeParse({ export: 'all' }).success).toBe(false);
  });

  it('requires UUID incident identifiers', () => {
    expect(incidentIdParamSchema.safeParse({ incidentId: 'not-a-uuid' }).success).toBe(false);
  });
});
