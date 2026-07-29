const SENSITIVE_KEY =
  /authorization|cookie|password|token|secret|encryption|database.?url|connection|string|description|contact|note|filename|object.?key|hash|storage.?path|latitude|longitude|coordinates/i;

export function redactLogMetadata(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactValue(value),
    ]),
  );
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (typeof value === 'object' && value !== null) {
    return redactLogMetadata(value as Record<string, unknown>);
  }
  return value;
}
