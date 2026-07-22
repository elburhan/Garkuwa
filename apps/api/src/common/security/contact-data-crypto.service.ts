import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

export const CONTACT_DATA_ENCRYPTION_KEY = Symbol('CONTACT_DATA_ENCRYPTION_KEY');

const ALGORITHM = 'aes-256-gcm';
const FORMAT_VERSION = 'v1';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function decodeCanonicalBase64(value: string): Buffer {
  const decoded = Buffer.from(value, 'base64');

  if (decoded.toString('base64') !== value) {
    throw new Error('Encrypted contact data has an invalid format.');
  }

  return decoded;
}

@Injectable()
export class ContactDataCryptoService {
  private readonly key: Buffer;

  constructor(@Inject(CONTACT_DATA_ENCRYPTION_KEY) key: Buffer) {
    if (key.length !== 32) {
      throw new Error('The contact-data encryption key must contain exactly 32 bytes.');
    }

    this.key = Buffer.from(key);
  }

  encryptString(value: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      FORMAT_VERSION,
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decryptString(serializedValue: string): string {
    const parts = serializedValue.split(':');

    if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
      throw new Error('Encrypted contact data has an invalid format.');
    }

    try {
      const iv = decodeCanonicalBase64(parts[1]!);
      const authTag = decodeCanonicalBase64(parts[2]!);
      const ciphertext = decodeCanonicalBase64(parts[3]!);

      if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
        throw new Error('Encrypted contact data has an invalid format.');
      }

      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new Error('Encrypted contact data could not be authenticated.');
    }
  }
}
