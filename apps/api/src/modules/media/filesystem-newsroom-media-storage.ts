import { constants as fsConstants, createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { NewsroomMediaStorage } from './newsroom-media-storage.js';

export const NEWSROOM_MEDIA_STORAGE_ROOT = Symbol('NEWSROOM_MEDIA_STORAGE_ROOT');

@Injectable()
export class FilesystemNewsroomMediaStorage implements NewsroomMediaStorage {
  private readonly root: string;

  constructor(@Inject(NEWSROOM_MEDIA_STORAGE_ROOT) root: string) {
    this.root = resolve(root);
  }

  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await access(this.root, fsConstants.R_OK | fsConstants.W_OK);
  }

  private pathFor(objectKey: string): string {
    if (!/^newsroom\/images\/[a-z0-9/_-]+$/i.test(objectKey)) {
      throw new BadRequestException('Invalid newsroom media object key.');
    }
    const target = resolve(this.root, objectKey);
    if (!target.startsWith(`${this.root}${sep}`)) {
      throw new BadRequestException('Invalid newsroom media object key.');
    }
    return target;
  }

  async putObject(input: {
    objectKey: string;
    body: Buffer | Readable;
    contentType: string;
    contentLength: number;
  }): Promise<void> {
    const target = this.pathFor(input.objectKey);
    await mkdir(dirname(target), { recursive: true });
    await pipeline(
      Readable.from(input.body),
      createWriteStream(target, { flags: 'wx', mode: 0o644 }),
    );
    if ((await stat(target)).size !== input.contentLength) {
      await rm(target, { force: true });
      throw new Error('Newsroom media size verification failed.');
    }
  }

  async getObject(objectKey: string) {
    try {
      const target = this.pathFor(objectKey);
      const metadata = await stat(target);
      return {
        stream: createReadStream(target),
        contentLength: metadata.size,
        contentType: 'application/octet-stream',
      };
    } catch {
      throw new NotFoundException('Newsroom media content is unavailable.');
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    await rm(this.pathFor(objectKey), { force: true });
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
