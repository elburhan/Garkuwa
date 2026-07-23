import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { FilesystemIncidentObjectStorage } from '../src/modules/incidents/attachments/filesystem-incident-object-storage.js';

describe('filesystem incident object storage', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'garkuwa-storage-'));
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('stores, streams and deletes exact private bytes beneath its root', async () => {
    const storage = new FilesystemIncidentObjectStorage(root);
    const body = Buffer.from('private deterministic bytes');
    const objectKey = 'incidents/2026/07/test-object';
    await storage.putObject({
      objectKey,
      body,
      contentType: 'application/pdf',
      contentLength: body.length,
    });
    expect(await readFile(join(root, ...objectKey.split('/')))).toEqual(body);
    const result = await storage.getObject(objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(body);
    await storage.deleteObject(objectKey);
    await expect(storage.getObject(objectKey)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects traversal and absolute keys', async () => {
    const storage = new FilesystemIncidentObjectStorage(root);
    await expect(
      storage.putObject({
        objectKey: '../escape',
        body: Buffer.from('x'),
        contentType: 'application/pdf',
        contentLength: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
