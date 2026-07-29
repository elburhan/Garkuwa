import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { getApiEnvironment } from './environment.js';
import { redactLogMetadata } from './log-redaction.js';

interface ApiRequest {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  originalUrl?: string;
  requestId?: string;
}

interface ApiResponse {
  setHeader(name: string, value: string): void;
  statusCode: number;
  once(event: 'finish', listener: () => void): void;
  status(code: number): { json(body: Record<string, unknown>): void };
}

type MiddlewareNext = (error?: unknown) => void;

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function isPayloadTooLarge(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (('type' in error && error.type === 'entity.too.large') ||
      ('status' in error && error.status === 413))
  );
}

function requestIdFrom(request: ApiRequest): string {
  const supplied = request.headers['x-request-id'];
  const candidate = Array.isArray(supplied) ? supplied[0] : supplied;
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

export function configureApiHttpHardening(app: NestExpressApplication): void {
  const environment = getApiEnvironment();
  app.set('trust proxy', environment.TRUST_PROXY === 'loopback' ? 'loopback' : false);
  app.disable('x-powered-by');

  app.use((request: ApiRequest, response: ApiResponse, next: MiddlewareNext) => {
    const startedAt = performance.now();
    request.requestId = requestIdFrom(request);
    response.setHeader('X-Request-Id', request.requestId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    response.setHeader('Cache-Control', 'no-store');
    if (environment.NODE_ENV === 'production') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    response.once('finish', () => {
      const entry = redactLogMetadata({
        event: 'http_request',
        requestId: request.requestId,
        method: request.method,
        path: request.originalUrl?.split('?', 1)[0] ?? '',
        statusCode: response.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      });
      if (environment.NODE_ENV === 'production') {
        process.stdout.write(`${JSON.stringify(entry)}\n`);
      } else {
        Logger.log(JSON.stringify(entry), 'HttpRequest');
      }
    });
    next();
  });

  app.useBodyParser('json', { limit: '100kb' });
  app.use((error: unknown, _request: ApiRequest, response: ApiResponse, next: MiddlewareNext) => {
    if (!isPayloadTooLarge(error)) {
      next(error);
      return;
    }

    response.status(413).json({
      statusCode: 413,
      error: 'Payload Too Large',
      message: 'The JSON request body exceeds the 100kb limit.',
    });
  });

  const server = app.getHttpServer() as Server;
  server.requestTimeout = 0;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
}

export function configureApiCors(app: NestExpressApplication, allowedOrigin: string): void {
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, origin === undefined || origin === allowedOrigin);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });
}
