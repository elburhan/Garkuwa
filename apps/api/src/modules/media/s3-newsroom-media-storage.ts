import { Readable } from 'node:stream';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { NewsroomMediaStorage } from './newsroom-media-storage.js';

export const NEWSROOM_MEDIA_S3_CLIENT = Symbol('NEWSROOM_MEDIA_S3_CLIENT');
export const NEWSROOM_MEDIA_S3_CONFIG = Symbol('NEWSROOM_MEDIA_S3_CONFIG');

export interface NewsroomMediaS3Config {
  bucket: string;
  dependencyCheckTimeoutMs: number;
  operationTimeoutMs: number;
  serverSideEncryption: 'AES256' | 'aws:kms';
  kmsKeyId?: string;
}

@Injectable()
export class S3NewsroomMediaStorage implements NewsroomMediaStorage {
  constructor(
    @Inject(NEWSROOM_MEDIA_S3_CLIENT) private readonly client: S3Client,
    @Inject(NEWSROOM_MEDIA_S3_CONFIG) private readonly configuration: NewsroomMediaS3Config,
  ) {}

  async initialize(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.configuration.bucket }), {
      abortSignal: AbortSignal.timeout(this.configuration.dependencyCheckTimeoutMs),
    });
  }

  async putObject(input: {
    objectKey: string;
    body: Buffer | Readable;
    contentType: string;
    contentLength: number;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.configuration.bucket,
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        ServerSideEncryption: this.configuration.serverSideEncryption,
        SSEKMSKeyId: this.configuration.kmsKeyId,
      }),
      { abortSignal: AbortSignal.timeout(this.configuration.operationTimeoutMs) },
    );
  }

  async getObject(objectKey: string) {
    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.configuration.bucket, Key: objectKey }),
        {
          abortSignal: AbortSignal.timeout(this.configuration.operationTimeoutMs),
        },
      );
      if (!(object.Body instanceof Readable)) throw new Error('Unsupported media stream.');
      return {
        stream: object.Body,
        contentLength: object.ContentLength ?? 0,
        contentType: object.ContentType ?? 'application/octet-stream',
      };
    } catch {
      throw new NotFoundException('Newsroom media content is unavailable.');
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.configuration.bucket, Key: objectKey }),
      {
        abortSignal: AbortSignal.timeout(this.configuration.operationTimeoutMs),
      },
    );
  }

  close(): Promise<void> {
    this.client.destroy();
    return Promise.resolve();
  }
}
