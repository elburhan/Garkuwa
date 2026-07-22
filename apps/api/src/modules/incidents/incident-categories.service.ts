import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';

export interface PublicIncidentCategory {
  id: string;
  nameHa: string;
  nameEn: string;
  descriptionHa: string | null;
  descriptionEn: string | null;
}

@Injectable()
export class IncidentCategoriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findActive(): Promise<PublicIncidentCategory[]> {
    try {
      return await this.prisma.incidentCategory.findMany({
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
    } catch {
      throw new InternalServerErrorException('Incident categories could not be loaded.');
    }
  }
}
