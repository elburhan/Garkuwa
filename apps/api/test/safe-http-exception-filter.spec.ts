import type { ArgumentsHost } from '@nestjs/common';
import { jest } from '@jest/globals';

import { SafeHttpExceptionFilter } from '../src/config/safe-http-exception.filter.js';

describe('SafeHttpExceptionFilter', () => {
  it('sanitizes unexpected errors and includes the request ID', () => {
    const json = jest.fn<(body: Record<string, unknown>) => void>();
    const response = {
      status: jest.fn<(code: number) => unknown>(),
      json,
    };
    response.status.mockReturnValue(response);
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/api/example?secret=fake',
          requestId: 'request-123',
        }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    new SafeHttpExceptionFilter().catch(new Error('fake DATABASE_URL and stack details'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'The request could not be completed.',
      requestId: 'request-123',
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain('DATABASE_URL');
  });
});
