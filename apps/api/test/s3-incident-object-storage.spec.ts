import { Readable } from 'node:stream';

import { HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { jest } from '@jest/globals';

import {
  S3IncidentObjectStorage,
  type IncidentS3Configuration,
} from '../src/modules/incidents/attachments/s3-incident-object-storage.js';

const configuration: IncidentS3Configuration = {
  bucket: 'private-test-bucket',
  dependencyCheckTimeoutMs: 1_000,
  operationTimeoutMs: 1_000,
  serverSideEncryption: 'AES256',
};

function createStorage() {
  const send = jest.fn<(command: unknown) => Promise<unknown>>().mockResolvedValue({});
  const destroy = jest.fn();
  const client = { send, destroy } as unknown as S3Client;
  return {
    destroy,
    send,
    storage: new S3IncidentObjectStorage(client, configuration),
  };
}

describe('S3-compatible incident object storage', () => {
  it('checks the configured private bucket for readiness', async () => {
    const { send, storage } = createStorage();
    await storage.checkHealth();

    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand);
    expect((send.mock.calls[0]?.[0] as HeadBucketCommand).input).toEqual({
      Bucket: configuration.bucket,
    });
  });

  it('writes an encrypted private object without requesting a public ACL', async () => {
    const { send, storage } = createStorage();
    const body = Buffer.from('fake evidence bytes');
    await storage.putObject({
      objectKey: 'incidents/2026/07/fake',
      body,
      contentType: 'application/pdf',
      contentLength: body.length,
    });

    const command = send.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: configuration.bucket,
      Key: 'incidents/2026/07/fake',
      Body: body,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256',
    });
    expect(command.input).not.toHaveProperty('ACL');
  });

  it('streams object bytes and closes the SDK client', async () => {
    const { destroy, send, storage } = createStorage();
    send.mockResolvedValueOnce({
      Body: Readable.from(Buffer.from('fake content')),
      ContentLength: 12,
      ContentType: 'application/pdf',
    });

    const result = await storage.getObject('incidents/2026/07/fake');
    expect(result).toMatchObject({
      contentLength: 12,
      contentType: 'application/pdf',
    });
    await storage.close();
    expect(destroy).toHaveBeenCalled();
  });
});
