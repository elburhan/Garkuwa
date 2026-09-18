import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BadRequestException } from '@nestjs/common';

import { FilesystemNewsroomMediaStorage } from '../src/modules/media/filesystem-newsroom-media-storage.js';

describe('FilesystemNewsroomMediaStorage', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'garkuwa-newsroom-media-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('keeps objects inside the newsroom image namespace', async () => {
    const storage = new FilesystemNewsroomMediaStorage(root);
    await storage.initialize();
    await storage.putObject({
      objectKey: 'newsroom/images/2026/09/example',
      body: Buffer.from('image'),
      contentType: 'image/jpeg',
      contentLength: 5,
    });
    const object = await storage.getObject('newsroom/images/2026/09/example');
    expect(object.contentLength).toBe(5);
  });

  it('rejects traversal and the private incident namespace', async () => {
    const storage = new FilesystemNewsroomMediaStorage(root);
    await expect(
      storage.putObject({
        objectKey: '../outside',
        body: Buffer.from('x'),
        contentType: 'image/jpeg',
        contentLength: 1,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      storage.putObject({
        objectKey: 'incidents/private-file',
        body: Buffer.from('x'),
        contentType: 'image/jpeg',
        contentLength: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
