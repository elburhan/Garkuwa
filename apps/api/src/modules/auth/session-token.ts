import { createHash, randomBytes } from 'node:crypto';

export function generateStaffSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashStaffSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
