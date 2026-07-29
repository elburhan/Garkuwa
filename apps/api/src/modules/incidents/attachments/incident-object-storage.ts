import type { Readable } from 'node:stream';

export const INCIDENT_OBJECT_STORAGE = Symbol('INCIDENT_OBJECT_STORAGE');

export interface IncidentObjectStorage {
  initialize(): Promise<void>;
  checkHealth(): Promise<void>;
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
