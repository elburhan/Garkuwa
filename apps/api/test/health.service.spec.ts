import { ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';

import type { PrismaService } from '../src/database/prisma.service.js';
import { HealthService } from '../src/health/health.service.js';
import type { IncidentObjectStorage } from '../src/modules/incidents/attachments/incident-object-storage.js';

function createSubject() {
  const database = {
    $queryRaw: jest.fn<() => Promise<unknown>>().mockResolvedValue([{ '?column?': 1 }]),
  } as unknown as PrismaService;
  const storage = {
    initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    checkHealth: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  } as unknown as IncidentObjectStorage;
  return {
    database,
    storage,
    subject: new HealthService(database, storage),
  };
}

describe('HealthService', () => {
  it('returns process liveness without checking dependencies', () => {
    const { subject, database, storage } = createSubject();
    const result = subject.getLiveness();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('garkuwa-api');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    expect(database.$queryRaw).not.toHaveBeenCalled();
    expect(storage.initialize).not.toHaveBeenCalled();
  });

  it('is unavailable before startup initialization', async () => {
    const { subject } = createSubject();
    await expect(subject.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('checks database and private storage before reporting ready', async () => {
    const { subject, database, storage } = createSubject();
    await subject.initialize();

    await expect(subject.getReadiness()).resolves.toMatchObject({
      status: 'ready',
      checks: { database: 'ok', privateObjectStorage: 'ok' },
    });
    expect(database.$queryRaw).toHaveBeenCalled();
    expect(storage.initialize).toHaveBeenCalled();
  });

  it('fails startup and later readiness safely when a dependency is unavailable', async () => {
    const startup = createSubject();
    jest.mocked(startup.storage.initialize).mockRejectedValueOnce(new Error('fake unavailable'));
    await expect(startup.subject.initialize()).rejects.toThrow('fake unavailable');
    await expect(startup.subject.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    const runtime = createSubject();
    await runtime.subject.initialize();
    jest.mocked(runtime.storage.checkHealth).mockRejectedValueOnce(new Error('fake unavailable'));
    await expect(runtime.subject.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('becomes unavailable when shutdown starts and closes storage', async () => {
    const { subject, storage } = createSubject();
    await subject.initialize();
    subject.beforeApplicationShutdown();

    await expect(subject.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await subject.onApplicationShutdown();
    expect(storage.close).toHaveBeenCalled();
  });
});
