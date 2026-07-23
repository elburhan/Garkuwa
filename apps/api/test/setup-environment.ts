import { randomBytes } from 'node:crypto';

process.env.CONTACT_DATA_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');
process.env.STAFF_SESSION_COOKIE_SECURE ??= 'false';
process.env.INCIDENT_STORAGE_DRIVER ??= 'filesystem';
process.env.INCIDENT_STORAGE_FILESYSTEM_ROOT ??= '.var/test-incident-uploads';
