import { randomBytes } from 'node:crypto';

process.env.CONTACT_DATA_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');
