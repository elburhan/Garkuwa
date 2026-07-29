import { Module } from '@nestjs/common';
import { resolve } from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';

import {
  CONTACT_DATA_ENCRYPTION_KEY,
  ContactDataCryptoService,
} from '../../common/security/contact-data-crypto.service.js';
import { decodeContactDataEncryptionKey } from '../../common/security/contact-data-key.js';
import { getApiEnvironment } from '../../config/environment.js';
import { AuthModule } from '../auth/auth.module.js';
import { AdminIncidentsController } from './admin/admin-incidents.controller.js';
import { AdminIncidentsService } from './admin/admin-incidents.service.js';
import { generateIncidentCaseId } from './incident-case-id.js';
import { IncidentCategoriesService } from './incident-categories.service.js';
import {
  INCIDENT_CASE_ID_GENERATOR,
  IncidentSubmissionService,
} from './incident-submission.service.js';
import { PublicIncidentsController } from './public-incidents.controller.js';
import { PublicIncidentCategoriesController } from './public-incident-categories.controller.js';
import { PUBLIC_INCIDENT_CLOCK, PublicIncidentAbuseGuard } from './public-incident-abuse.guard.js';
import {
  INCIDENT_WORKFLOW_CLOCK,
  IncidentWorkflowService,
} from './workflow/incident-workflow.service.js';
import {
  CONTACT_ACCESS_CLOCK,
  ContactAccessRateLimitGuard,
} from './contact-access/contact-access-rate-limit.guard.js';
import { IncidentContactAccessService } from './contact-access/incident-contact-access.service.js';
import { IncidentStaffNotesService } from './staff-notes/incident-staff-notes.service.js';
import {
  STAFF_NOTE_CLOCK,
  StaffNoteRateLimitGuard,
} from './staff-notes/staff-note-rate-limit.guard.js';
import { IncidentAttachmentsService } from './attachments/incident-attachments.service.js';
import {
  FilesystemIncidentObjectStorage,
  INCIDENT_STORAGE_ROOT,
} from './attachments/filesystem-incident-object-storage.js';
import { INCIDENT_OBJECT_STORAGE } from './attachments/incident-object-storage.js';
import type { IncidentObjectStorage } from './attachments/incident-object-storage.js';
import {
  INCIDENT_S3_CLIENT,
  INCIDENT_S3_CONFIGURATION,
  S3IncidentObjectStorage,
} from './attachments/s3-incident-object-storage.js';
import {
  ATTACHMENT_REVIEW_CLOCK,
  AttachmentReviewRateLimitGuard,
} from './attachments/security-review/attachment-review-rate-limit.guard.js';
import {
  ATTACHMENT_SECURITY_REVIEW_CLOCK,
  AttachmentSecurityReviewService,
} from './attachments/security-review/attachment-security-review.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    PublicIncidentCategoriesController,
    PublicIncidentsController,
    AdminIncidentsController,
  ],
  providers: [
    AdminIncidentsService,
    IncidentWorkflowService,
    IncidentContactAccessService,
    ContactAccessRateLimitGuard,
    IncidentStaffNotesService,
    StaffNoteRateLimitGuard,
    IncidentAttachmentsService,
    AttachmentSecurityReviewService,
    AttachmentReviewRateLimitGuard,
    FilesystemIncidentObjectStorage,
    S3IncidentObjectStorage,
    IncidentCategoriesService,
    IncidentSubmissionService,
    ContactDataCryptoService,
    PublicIncidentAbuseGuard,
    {
      provide: INCIDENT_STORAGE_ROOT,
      useFactory: () =>
        resolve(
          process.cwd(),
          getApiEnvironment().INCIDENT_STORAGE_FILESYSTEM_ROOT ?? '.var/incident-uploads',
        ),
    },
    {
      provide: INCIDENT_S3_CONFIGURATION,
      useFactory: () => {
        const environment = getApiEnvironment();
        return {
          bucket: environment.S3_BUCKET ?? '',
          dependencyCheckTimeoutMs: environment.DEPENDENCY_CHECK_TIMEOUT_MS,
          operationTimeoutMs: environment.STORAGE_OPERATION_TIMEOUT_MS,
          serverSideEncryption: environment.S3_SERVER_SIDE_ENCRYPTION,
          kmsKeyId: environment.S3_KMS_KEY_ID,
        };
      },
    },
    {
      provide: INCIDENT_S3_CLIENT,
      useFactory: () => {
        const environment = getApiEnvironment();
        return new S3Client({
          endpoint: environment.S3_ENDPOINT,
          region: environment.S3_REGION ?? 'us-east-1',
          forcePathStyle: environment.S3_FORCE_PATH_STYLE,
          credentials:
            environment.S3_ACCESS_KEY_ID && environment.S3_SECRET_ACCESS_KEY
              ? {
                  accessKeyId: environment.S3_ACCESS_KEY_ID,
                  secretAccessKey: environment.S3_SECRET_ACCESS_KEY,
                }
              : undefined,
        });
      },
    },
    {
      provide: INCIDENT_OBJECT_STORAGE,
      inject: [FilesystemIncidentObjectStorage, S3IncidentObjectStorage],
      useFactory: (
        filesystem: FilesystemIncidentObjectStorage,
        s3: S3IncidentObjectStorage,
      ): IncidentObjectStorage =>
        getApiEnvironment().INCIDENT_STORAGE_DRIVER === 's3' ? s3 : filesystem,
    },
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
    {
      provide: INCIDENT_WORKFLOW_CLOCK,
      useValue: Date.now,
    },
    {
      provide: CONTACT_ACCESS_CLOCK,
      useValue: Date.now,
    },
    {
      provide: STAFF_NOTE_CLOCK,
      useValue: Date.now,
    },
    {
      provide: ATTACHMENT_REVIEW_CLOCK,
      useValue: Date.now,
    },
    {
      provide: ATTACHMENT_SECURITY_REVIEW_CLOCK,
      useValue: Date.now,
    },
  ],
  exports: [INCIDENT_OBJECT_STORAGE],
})
export class IncidentsModule {}
