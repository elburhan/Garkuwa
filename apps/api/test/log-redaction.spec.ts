import { redactLogMetadata } from '../src/config/log-redaction.js';

describe('structured log redaction', () => {
  it('redacts sensitive values recursively while retaining operational metadata', () => {
    const result = redactLogMetadata({
      requestId: 'request-1',
      statusCode: 500,
      password: 'fake-password',
      nested: {
        authorization: 'Bearer fake-token',
        incidentDescription: 'fake report content',
        objectKey: 'private/object',
      },
    });

    expect(result).toEqual({
      requestId: 'request-1',
      statusCode: 500,
      password: '[REDACTED]',
      nested: {
        authorization: '[REDACTED]',
        incidentDescription: '[REDACTED]',
        objectKey: '[REDACTED]',
      },
    });
  });
});
