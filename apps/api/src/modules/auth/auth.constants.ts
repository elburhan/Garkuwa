export const STAFF_SESSION_COOKIE_NAME = 'garkuwa_staff_session';
export const STAFF_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
export const STAFF_LOGIN_FAILURE_LIMIT = 5;
export const STAFF_LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;
export const STAFF_LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
export const STAFF_LOGIN_RATE_LIMIT = 5;

export const STAFF_AUTH_CLOCK = Symbol('STAFF_AUTH_CLOCK');
export type StaffAuthClock = () => number;
