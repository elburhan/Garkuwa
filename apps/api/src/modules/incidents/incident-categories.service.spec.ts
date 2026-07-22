import { InternalServerErrorException } from '@nestjs/common';
import { jest } from '@jest/globals';

import type { PrismaService } from '../../database/prisma.service.js';
import { IncidentCategoriesService } from './incident-categories.service.js';

describe('IncidentCategoriesService', () => {
  const findMany = jest.fn<() => Promise<unknown[]>>();
  const prisma = { incidentCategory: { findMany } } as unknown as PrismaService;
  const service = new IncidentCategoriesService(prisma);

  beforeEach(() => {
    findMany.mockReset();
  });

  it('returns only the explicitly selected fields from active categories in display order', async () => {
    const categories = [
      {
        id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
        nameHa: 'Wani lamari',
        nameEn: 'Other incident',
        descriptionHa: null,
        descriptionEn: null,
      },
    ];
    findMany.mockResolvedValue(categories);

    await expect(service.findActive()).resolves.toEqual(categories);
    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { nameHa: 'asc' }],
      select: {
        id: true,
        nameHa: true,
        nameEn: true,
        descriptionHa: true,
        descriptionEn: true,
      },
    });
  });

  it('replaces database errors with a safe public error', async () => {
    findMany.mockRejectedValue(new Error('database connection details'));

    await expect(service.findActive()).rejects.toEqual(
      new InternalServerErrorException('Incident categories could not be loaded.'),
    );
  });
});
