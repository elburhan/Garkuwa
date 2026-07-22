import { createHash } from 'node:crypto';

import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

export const PUBLIC_INCIDENT_CLOCK = Symbol('PUBLIC_INCIDENT_CLOCK');
export type PublicIncidentClock = () => number;

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

interface PublicIncidentRequest {
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket: { remoteAddress?: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizedString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  return typeof value === 'string' ? value.trim() : '';
}

@Injectable()
export class PublicIncidentAbuseGuard implements CanActivate {
  private readonly requestsByIp = new Map<string, number[]>();
  private readonly duplicateExpirations = new Map<string, number>();

  constructor(
    @Inject(PUBLIC_INCIDENT_CLOCK)
    private readonly now: PublicIncidentClock,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PublicIncidentRequest>();
    this.assertJsonContentType(request);

    const timestamp = this.now();
    const clientIp = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    this.removeExpiredEntries(timestamp);
    this.consumeRateLimit(clientIp, timestamp);
    this.rejectRecentDuplicate(clientIp, request.body, timestamp);

    return true;
  }

  reset(): void {
    this.requestsByIp.clear();
    this.duplicateExpirations.clear();
  }

  private assertJsonContentType(request: PublicIncidentRequest): void {
    const header = request.headers['content-type'];
    const contentType = Array.isArray(header) ? header[0] : header;
    const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();

    if (mediaType !== 'application/json') {
      throw new UnsupportedMediaTypeException('Content-Type must be application/json.');
    }
  }

  private consumeRateLimit(clientIp: string, timestamp: number): void {
    const activeRequests = (this.requestsByIp.get(clientIp) ?? []).filter(
      (requestTime) => requestTime > timestamp - RATE_WINDOW_MS,
    );

    if (activeRequests.length >= RATE_LIMIT) {
      this.throwRateLimitError();
    }

    activeRequests.push(timestamp);
    this.requestsByIp.set(clientIp, activeRequests);
  }

  private rejectRecentDuplicate(clientIp: string, body: unknown, timestamp: number): void {
    const fingerprint = this.createFingerprint(body);

    if (!fingerprint) {
      return;
    }

    const key = `${clientIp}:${fingerprint}`;

    if ((this.duplicateExpirations.get(key) ?? 0) > timestamp) {
      this.throwRateLimitError();
    }

    this.duplicateExpirations.set(key, timestamp + DUPLICATE_WINDOW_MS);
  }

  private createFingerprint(body: unknown): string | undefined {
    if (!isRecord(body)) {
      return undefined;
    }

    const categoryId = normalizedString(body, 'categoryId');
    const description = normalizedString(body, 'description');

    if (!categoryId || !description) {
      return undefined;
    }

    const normalizedFields = [
      categoryId,
      description,
      normalizedString(body, 'incidentDate'),
      normalizedString(body, 'state').toLowerCase(),
      normalizedString(body, 'lga').toLowerCase(),
    ];

    return createHash('sha256').update(JSON.stringify(normalizedFields)).digest('hex');
  }

  private removeExpiredEntries(timestamp: number): void {
    for (const [clientIp, requestTimes] of this.requestsByIp) {
      const activeRequests = requestTimes.filter(
        (requestTime) => requestTime > timestamp - RATE_WINDOW_MS,
      );

      if (activeRequests.length === 0) {
        this.requestsByIp.delete(clientIp);
      } else {
        this.requestsByIp.set(clientIp, activeRequests);
      }
    }

    for (const [key, expiration] of this.duplicateExpirations) {
      if (expiration <= timestamp) {
        this.duplicateExpirations.delete(key);
      }
    }
  }

  private throwRateLimitError(): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Too many incident submissions. Please try again later.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
