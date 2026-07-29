import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

import { redactLogMetadata } from './log-redaction.js';

interface RequestWithId {
  method: string;
  originalUrl?: string;
  requestId?: string;
}

interface ErrorResponse {
  status(code: number): ErrorResponse;
  json(body: Record<string, unknown>): void;
}

function safeHttpBody(exception: HttpException): Record<string, unknown> {
  const statusCode = exception.getStatus();
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return {
      statusCode,
      error: exception.name.replace(/Exception$/, '') || 'Request Error',
      message: body,
    };
  }
  return { ...body, statusCode };
}

@Catch()
export class SafeHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<ErrorResponse>();
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException
      ? safeHttpBody(exception)
      : {
          statusCode,
          error: 'Internal Server Error',
          message: 'The request could not be completed.',
        };

    if (!isHttpException || statusCode >= 500) {
      this.logger.error(
        redactLogMetadata({
          event: 'http_error',
          requestId: request.requestId,
          method: request.method,
          path: request.originalUrl?.split('?', 1)[0] ?? '',
          statusCode,
        }),
      );
    }

    response.status(statusCode).json({
      ...body,
      requestId: request.requestId,
    });
  }
}
