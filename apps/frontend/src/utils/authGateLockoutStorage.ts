const LOCKOUT_PREFIX = 'rsAuthGateLockout:';
const ACTIVE_KEY = 'rsAuthGateLockoutActiveKey';

export type AuthGateLockoutRecord = {
  lockedUntilMs: number;
  identifierKey: string;
};

function storageKey(identifierKey: string): string {
  return `${LOCKOUT_PREFIX}${identifierKey}`;
}

export function buildAuthGateIdentifierKey(payload: {
  email?: string;
  phone_number?: string;
}): string {
  if (payload.email) return `email:${payload.email.trim().toLowerCase()}`;
  if (payload.phone_number) return `phone:${payload.phone_number.trim()}`;
  return '';
}

export function readAuthGateLockout(
  identifierKey: string
): AuthGateLockoutRecord | null {
  if (!identifierKey || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(identifierKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthGateLockoutRecord;
    if (!parsed?.lockedUntilMs) return null;
    if (parsed.lockedUntilMs <= Date.now()) {
      sessionStorage.removeItem(storageKey(identifierKey));
      return null;
    }
    return { ...parsed, identifierKey };
  } catch {
    return null;
  }
}

export function writeAuthGateLockout(
  identifierKey: string,
  lockedUntilMs: number
): AuthGateLockoutRecord {
  const record: AuthGateLockoutRecord = { identifierKey, lockedUntilMs };
  try {
    sessionStorage.setItem(storageKey(identifierKey), JSON.stringify(record));
    sessionStorage.setItem(ACTIVE_KEY, identifierKey);
  } catch {
    // ignore quota / private mode
  }
  return record;
}

export function readActiveAuthGateLockout(): AuthGateLockoutRecord | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const identifierKey = sessionStorage.getItem(ACTIVE_KEY) || '';
    if (!identifierKey) return null;
    return readAuthGateLockout(identifierKey);
  } catch {
    return null;
  }
}

export function clearAuthGateLockout(identifierKey: string): void {
  if (!identifierKey) return;
  try {
    sessionStorage.removeItem(storageKey(identifierKey));
    if (sessionStorage.getItem(ACTIVE_KEY) === identifierKey) {
      sessionStorage.removeItem(ACTIVE_KEY);
    }
  } catch {
    // ignore
  }
}

export function lockoutMinutesFromMs(ms: number): number {
  return Math.max(1, Math.ceil(ms / 60_000));
}
