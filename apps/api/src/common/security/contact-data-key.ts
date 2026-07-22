const CONTACT_DATA_KEY_BYTES = 32;

export function decodeContactDataEncryptionKey(value: string): Buffer {
  const decoded = Buffer.from(value, 'base64');
  const isCanonicalBase64 = decoded.toString('base64') === value;

  if (!isCanonicalBase64 || decoded.length !== CONTACT_DATA_KEY_BYTES) {
    throw new Error('CONTACT_DATA_ENCRYPTION_KEY must be base64-encoded and decode to 32 bytes.');
  }

  return decoded;
}

export function isValidContactDataEncryptionKey(value: string): boolean {
  try {
    decodeContactDataEncryptionKey(value);
    return true;
  } catch {
    return false;
  }
}
