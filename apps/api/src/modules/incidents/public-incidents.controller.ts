import { Body, Controller, HttpCode, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';

import { createIncidentSchema, ZodValidationPipe } from './dto/create-incident.dto.js';
import type { CreateIncidentDto } from './dto/create-incident.dto.js';
import { IncidentSubmissionService } from './incident-submission.service.js';
import type { IncidentSubmissionResponse } from './incident-submission.service.js';
import { PublicIncidentAbuseGuard } from './public-incident-abuse.guard.js';

@Controller('public/incidents')
export class PublicIncidentsController {
  constructor(
    @Inject(IncidentSubmissionService)
    private readonly incidentSubmissionService: IncidentSubmissionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PublicIncidentAbuseGuard)
  submit(
    @Body(new ZodValidationPipe(createIncidentSchema)) input: CreateIncidentDto,
  ): Promise<IncidentSubmissionResponse> {
    return this.incidentSubmissionService.submit(input);
  }
}
