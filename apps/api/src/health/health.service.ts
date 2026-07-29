import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { BeforeApplicationShutdown, OnApplicationShutdown } from '@nestjs/common';

import { getApiEnvironment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  INCIDENT_OBJECT_STORAGE,
  type IncidentObjectStorage,
} from '../modules/incidents/attachments/incident-object-storage.js';

export interface HealthResponse {
  status: 'ok';
  service: 'garkuwa-api';
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready';
  service: 'garkuwa-api';
  timestamp: string;
  checks: {
    database: 'ok';
    privateObjectStorage: 'ok';
  };
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    operation,
    new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Dependency check timed out.')), timeoutMs);
      timer.unref();
    }),
  ]);
}

@Injectable()
export class HealthService implements BeforeApplicationShutdown, OnApplicationShutdown {
  private acceptingTraffic = false;

  constructor(
    @Inject(PrismaService) private readonly database: PrismaService,
    @Inject(INCIDENT_OBJECT_STORAGE) private readonly storage: IncidentObjectStorage,
  ) {}

  getHealth(): HealthResponse {
    return this.getLiveness();
  }

  getLiveness(): HealthResponse {
    return {
      status: 'ok',
      service: 'garkuwa-api',
      timestamp: new Date().toISOString(),
    };
  }

  async initialize(): Promise<void> {
    this.acceptingTraffic = false;
    const { DEPENDENCY_CHECK_TIMEOUT_MS } = getApiEnvironment();
    await withTimeout(this.storage.initialize(), DEPENDENCY_CHECK_TIMEOUT_MS);
    await this.checkDependencies();
    this.acceptingTraffic = true;
  }

  async getReadiness(): Promise<ReadinessResponse> {
    if (!this.acceptingTraffic) {
      this.throwUnavailable();
    }

    try {
      await this.checkDependencies();
    } catch {
      this.throwUnavailable();
    }

    return {
      status: 'ready',
      service: 'garkuwa-api',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
        privateObjectStorage: 'ok',
      },
    };
  }

  beforeApplicationShutdown(): void {
    this.acceptingTraffic = false;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.storage.close?.();
  }

  private async checkDependencies(): Promise<void> {
    const { DEPENDENCY_CHECK_TIMEOUT_MS } = getApiEnvironment();
    await Promise.all([
      withTimeout(this.database.$queryRaw`SELECT 1`, DEPENDENCY_CHECK_TIMEOUT_MS),
      withTimeout(this.storage.checkHealth(), DEPENDENCY_CHECK_TIMEOUT_MS),
    ]);
  }

  private throwUnavailable(): never {
    throw new ServiceUnavailableException({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'The API is not ready to receive traffic.',
    });
  }
}
