import { Module } from '@nestjs/common';

import {
  CONTACT_DATA_ENCRYPTION_KEY,
  ContactDataCryptoService,
} from '../../common/security/contact-data-crypto.service.js';
import { decodeContactDataEncryptionKey } from '../../common/security/contact-data-key.js';
import { getApiEnvironment } from '../../config/environment.js';
import { generateIncidentCaseId } from './incident-case-id.js';
import { IncidentCategoriesService } from './incident-categories.service.js';
import {
  INCIDENT_CASE_ID_GENERATOR,
  IncidentSubmissionService,
} from './incident-submission.service.js';
import { PublicIncidentsController } from './public-incidents.controller.js';
import { PublicIncidentCategoriesController } from './public-incident-categories.controller.js';
import { PUBLIC_INCIDENT_CLOCK, PublicIncidentAbuseGuard } from './public-incident-abuse.guard.js';

@Module({
  controllers: [PublicIncidentCategoriesController, PublicIncidentsController],
  providers: [
    IncidentCategoriesService,
    IncidentSubmissionService,
    ContactDataCryptoService,
    PublicIncidentAbuseGuard,
    {
      provide: CONTACT_DATA_ENCRYPTION_KEY,
      useFactory: () =>
        decodeContactDataEncryptionKey(getApiEnvironment().CONTACT_DATA_ENCRYPTION_KEY),
    },
    {
      provide: INCIDENT_CASE_ID_GENERATOR,
      useValue: generateIncidentCaseId,
    },
    {
      provide: PUBLIC_INCIDENT_CLOCK,
      useValue: Date.now,
    },
  ],
})
export class IncidentsModule {}
