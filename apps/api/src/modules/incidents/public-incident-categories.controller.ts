import { Controller, Get, Inject } from '@nestjs/common';

import {
  IncidentCategoriesService,
  type PublicIncidentCategory,
} from './incident-categories.service.js';

@Controller('public/incident-categories')
export class PublicIncidentCategoriesController {
  constructor(
    @Inject(IncidentCategoriesService)
    private readonly incidentCategoriesService: IncidentCategoriesService,
  ) {}

  @Get()
  async findActive(): Promise<{ categories: PublicIncidentCategory[] }> {
    return { categories: await this.incidentCategoriesService.findActive() };
  }
}
