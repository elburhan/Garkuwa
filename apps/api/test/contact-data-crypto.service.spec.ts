import { ContactDataCryptoService } from '../src/common/security/contact-data-crypto.service.js';
import { decodeContactDataEncryptionKey } from '../src/common/security/contact-data-key.js';
import { getApiEnvironment } from '../src/config/environment.js';

describe('ContactDataCryptoService', () => {
  const key = Buffer.alloc(32, 7);
  const service = new ContactDataCryptoService(key);

  it('round-trips authenticated encrypted values without exposing plaintext', () => {
    const plaintext = 'Fake contact value for testing';
    const encrypted = service.encryptString(plaintext);

    expect(encrypted).toMatch(/^v1:[^:]+:[^:]+:[^:]+$/);
    expect(encrypted).not.toContain(plaintext);
    expect(service.decryptString(encrypted)).toBe(plaintext);
  });

  it('uses a random IV for every encrypted value', () => {
    const first = service.encryptString('same fake value');
    const second = service.encryptString('same fake value');

    expect(first).not.toBe(second);
    expect(service.decryptString(first)).toBe('same fake value');
    expect(service.decryptString(second)).toBe('same fake value');
  });

  it('rejects authenticated ciphertext that has been altered', () => {
    const parts = service.encryptString('fake value').split(':');
    const ciphertext = Buffer.from(parts[3]!, 'base64');
    ciphertext[0] = ciphertext[0]! ^ 1;
    parts[3] = ciphertext.toString('base64');

    expect(() => service.decryptString(parts.join(':'))).toThrow(
      'Encrypted contact data could not be authenticated.',
    );
  });

  it.each(['plaintext', 'v2:a:b:c', 'v1:not-base64:b:c'])('rejects invalid format %s', (value) => {
    expect(() => service.decryptString(value)).toThrow();
  });

  it('rejects an invalid key length without including key material in the error', () => {
    const invalidKey = Buffer.alloc(16, 9);

    expect(() => new ContactDataCryptoService(invalidKey)).toThrow('exactly 32 bytes');
  });

  it('accepts only canonical base64 representing 32 bytes', () => {
    const encodedKey = key.toString('base64');

    expect(decodeContactDataEncryptionKey(encodedKey)).toEqual(key);
    expect(() => decodeContactDataEncryptionKey(Buffer.alloc(31).toString('base64'))).toThrow(
      'CONTACT_DATA_ENCRYPTION_KEY',
    );
    expect(() => decodeContactDataEncryptionKey('not-a-key')).toThrow(
      'CONTACT_DATA_ENCRYPTION_KEY',
    );
  });

  it('fails environment validation without echoing an invalid secret value', () => {
    const previousValue = process.env.CONTACT_DATA_ENCRYPTION_KEY;
    const invalidValue = 'invalid-secret-value-that-must-not-appear';
    process.env.CONTACT_DATA_ENCRYPTION_KEY = invalidValue;

    try {
      expect(getApiEnvironment).toThrow('CONTACT_DATA_ENCRYPTION_KEY');
      expect(() => getApiEnvironment()).toThrow('exactly 32 bytes');

      try {
        getApiEnvironment();
      } catch (error) {
        expect(String(error)).not.toContain(invalidValue);
      }
    } finally {
      if (previousValue === undefined) {
        delete process.env.CONTACT_DATA_ENCRYPTION_KEY;
      } else {
        process.env.CONTACT_DATA_ENCRYPTION_KEY = previousValue;
      }
    }
  });
});
