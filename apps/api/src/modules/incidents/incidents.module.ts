import { Module } from '@nestjs/common';

import { generateIncidentCaseId } from './incident-case-id.js';
import {
  INCIDENT_CASE_ID_GENERATOR,
  IncidentSubmissionService,
} from './incident-submission.service.js';
import { PublicIncidentsController } from './public-incidents.controller.js';

@Module({
  controllers: [PublicIncidentsController],
  providers: [
    IncidentSubmissionService,
    {
      provide: INCIDENT_CASE_ID_GENERATOR,
      useValue: generateIncidentCaseId,
    },
  ],
})
export class IncidentsModule {}
