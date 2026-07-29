import { constants as fsConstants, createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

export const INCIDENT_STORAGE_ROOT = Symbol('INCIDENT_STORAGE_ROOT');

@Injectable()
export class FilesystemIncidentObjectStorage {
  private readonly root: string;

  constructor(@Inject(INCIDENT_STORAGE_ROOT) root: string) {
    this.root = resolve(root);
  }

  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await access(this.root, fsConstants.R_OK | fsConstants.W_OK);
  }

  async checkHealth(): Promise<void> {
    const metadata = await stat(this.root);
    if (!metadata.isDirectory()) {
      throw new Error('Private incident storage root is not a directory.');
    }
    await access(this.root, fsConstants.R_OK | fsConstants.W_OK);
  }

  private pathFor(objectKey: string): string {
    if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(objectKey)) {
      throw new BadRequestException('Invalid private object key.');
    }
    const target = resolve(this.root, objectKey);
    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) {
      throw new BadRequestException('Invalid private object key.');
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
      createWriteStream(target, { flags: 'wx', mode: 0o600 }),
    );
    const stored = await stat(target);
    if (stored.size !== input.contentLength) {
      await rm(target, { force: true });
      throw new Error('Private object size verification failed.');
    }
  }

  async getObject(objectKey: string) {
    const target = this.pathFor(objectKey);
    try {
      const metadata = await stat(target);
      return {
        stream: createReadStream(target),
        contentLength: metadata.size,
        contentType: 'application/octet-stream',
      };
    } catch {
      throw new NotFoundException('Attachment content is unavailable.');
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    await rm(this.pathFor(objectKey), { force: true });
  }

  async close(): Promise<void> {}
}
