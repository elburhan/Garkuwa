import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';

import { createIncidentSchema, ZodValidationPipe } from './dto/create-incident.dto.js';
import type { CreateIncidentDto } from './dto/create-incident.dto.js';
import { IncidentSubmissionService } from './incident-submission.service.js';
import type { IncidentSubmissionResponse } from './incident-submission.service.js';

@Controller('public/incidents')
export class PublicIncidentsController {
  constructor(
    @Inject(IncidentSubmissionService)
    private readonly incidentSubmissionService: IncidentSubmissionService,
  ) {}

  // TODO(security): Add production-approved rate limiting and anti-abuse controls before launch.
  @Post()
  @HttpCode(HttpStatus.CREATED)
  submit(
    @Body(new ZodValidationPipe(createIncidentSchema)) input: CreateIncidentDto,
  ): Promise<IncidentSubmissionResponse> {
    return this.incidentSubmissionService.submit(input);
  }
}
