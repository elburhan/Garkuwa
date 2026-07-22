import type { Server } from 'node:http';

import type { NestExpressApplication } from '@nestjs/platform-express';

interface JsonErrorResponse {
  status(code: number): { json(body: Record<string, unknown>): void };
}

type ErrorMiddlewareNext = (error?: unknown) => void;

function isPayloadTooLarge(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (('type' in error && error.type === 'entity.too.large') ||
      ('status' in error && error.status === 413))
  );
}

export function configureApiHttpHardening(app: NestExpressApplication): void {
  app.set('trust proxy', false);
  app.useBodyParser('json', { limit: '100kb' });
  app.use(
    (error: unknown, _request: unknown, response: JsonErrorResponse, next: ErrorMiddlewareNext) => {
      if (!isPayloadTooLarge(error)) {
        next(error);
        return;
      }

      response.status(413).json({
        statusCode: 413,
        error: 'Payload Too Large',
        message: 'The JSON request body exceeds the 100kb limit.',
      });
    },
  );

  const server = app.getHttpServer() as Server;
  server.requestTimeout = 10_000;
}
