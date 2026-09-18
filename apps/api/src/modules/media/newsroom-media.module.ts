import { resolve } from 'node:path';

import { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';

import { getApiEnvironment } from '../../config/environment.js';
import { AuthModule } from '../auth/auth.module.js';
import { AdminNewsroomMediaController } from './admin-newsroom-media.controller.js';
import {
  FilesystemNewsroomMediaStorage,
  NEWSROOM_MEDIA_STORAGE_ROOT,
} from './filesystem-newsroom-media-storage.js';
import { NEWSROOM_MEDIA_STORAGE, type NewsroomMediaStorage } from './newsroom-media-storage.js';
import { NewsroomMediaService } from './newsroom-media.service.js';
import { PublicNewsroomMediaController } from './public-newsroom-media.controller.js';
import {
  NEWSROOM_MEDIA_S3_CLIENT,
  NEWSROOM_MEDIA_S3_CONFIG,
  S3NewsroomMediaStorage,
} from './s3-newsroom-media-storage.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminNewsroomMediaController, PublicNewsroomMediaController],
  providers: [
    NewsroomMediaService,
    FilesystemNewsroomMediaStorage,
    S3NewsroomMediaStorage,
    {
      provide: NEWSROOM_MEDIA_STORAGE_ROOT,
      useFactory: () => resolve(process.cwd(), getApiEnvironment().NEWSROOM_MEDIA_FILESYSTEM_ROOT),
    },
    {
      provide: NEWSROOM_MEDIA_S3_CONFIG,
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
      provide: NEWSROOM_MEDIA_S3_CLIENT,
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
      provide: NEWSROOM_MEDIA_STORAGE,
      inject: [FilesystemNewsroomMediaStorage, S3NewsroomMediaStorage],
      useFactory: (
        filesystem: FilesystemNewsroomMediaStorage,
        s3: S3NewsroomMediaStorage,
      ): NewsroomMediaStorage =>
        getApiEnvironment().INCIDENT_STORAGE_DRIVER === 's3' ? s3 : filesystem,
    },
  ],
  exports: [NewsroomMediaService],
})
export class NewsroomMediaModule {}
