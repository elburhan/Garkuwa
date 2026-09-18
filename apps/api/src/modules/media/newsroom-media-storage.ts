import type { Readable } from 'node:stream';

export const NEWSROOM_MEDIA_STORAGE = Symbol('NEWSROOM_MEDIA_STORAGE');

export interface NewsroomMediaStorage {
  initialize(): Promise<void>;
  putObject(input: {
    objectKey: string;
    body: Buffer | Readable;
    contentType: string;
    contentLength: number;
  }): Promise<void>;
  getObject(objectKey: string): Promise<{
    stream: Readable;
    contentLength: number;
    contentType: string;
  }>;
  deleteObject(objectKey: string): Promise<void>;
  close?(): Promise<void>;
}
