import { Readable } from 'node:stream';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';

import type { IncidentObjectStorage } from './incident-object-storage.js';

export const INCIDENT_S3_CLIENT = Symbol('INCIDENT_S3_CLIENT');
export const INCIDENT_S3_CONFIGURATION = Symbol('INCIDENT_S3_CONFIGURATION');

export interface IncidentS3Configuration {
  bucket: string;
  dependencyCheckTimeoutMs: number;
  operationTimeoutMs: number;
  serverSideEncryption: 'AES256' | 'aws:kms';
  kmsKeyId?: string;
}

function operationSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

@Injectable()
export class S3IncidentObjectStorage implements IncidentObjectStorage {
  constructor(
    @Inject(INCIDENT_S3_CLIENT) private readonly client: S3Client,
    @Inject(INCIDENT_S3_CONFIGURATION)
    private readonly configuration: IncidentS3Configuration,
  ) {}

  async initialize(): Promise<void> {
    await this.checkHealth();
  }

  async checkHealth(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.configuration.bucket }), {
      abortSignal: operationSignal(this.configuration.dependencyCheckTimeoutMs),
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
        ContentLength: input.contentLength,
        ContentType: input.contentType,
        ServerSideEncryption: this.configuration.serverSideEncryption,
        SSEKMSKeyId: this.configuration.kmsKeyId,
      }),
      { abortSignal: operationSignal(this.configuration.operationTimeoutMs) },
    );
  }

  async getObject(objectKey: string): Promise<{
    stream: Readable;
    contentLength: number;
    contentType: string;
  }> {
    try {
      const object = await this.client.send(
        new GetObjectCommand({
          Bucket: this.configuration.bucket,
          Key: objectKey,
        }),
        { abortSignal: operationSignal(this.configuration.operationTimeoutMs) },
      );
      if (!(object.Body instanceof Readable)) {
        throw new Error('Private object storage returned an unsupported stream.');
      }
      return {
        stream: object.Body,
        contentLength: object.ContentLength ?? 0,
        contentType: object.ContentType ?? 'application/octet-stream',
      };
    } catch {
      throw new NotFoundException('Attachment content is unavailable.');
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.configuration.bucket,
        Key: objectKey,
      }),
      { abortSignal: operationSignal(this.configuration.operationTimeoutMs) },
    );
  }

  close(): Promise<void> {
    this.client.destroy();
    return Promise.resolve();
  }
}
