import { environment } from '../config/environment';
import { getOrCreateRsAnonymousId } from './rsAnonymousId';

export const AUTH_GATE_PENDING_KEY = 'rsAuthGatePending';

export type AuthGatePending = {
  entry: string;
  shownAt: number;
  context: string;
  flag_on: boolean;
  auth_path: string;
};

export function stashAuthGatePending(pending: AuthGatePending): void {
  try {
    sessionStorage.setItem(AUTH_GATE_PENDING_KEY, JSON.stringify(pending));
  } catch {
    // ignore quota / private mode
  }
}

export function readAuthGatePending(): AuthGatePending | null {
  try {
    const raw = sessionStorage.getItem(AUTH_GATE_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthGatePending;
    if (!parsed?.entry || !parsed.shownAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAuthGatePending(): void {
  try {
    sessionStorage.removeItem(AUTH_GATE_PENDING_KEY);
  } catch {
    // ignore
  }
}

export function hasLegacyAuth0SpaSession(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.includes('@@auth0spajs@@')) return true;
  }
  return false;
}

export async function postAuthFunnelSiteEvent(
  payload: {
    eventType: string;
    metadata?: Record<string, unknown>;
  },
  userSub?: string
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'web',
  };
  if (userSub) headers['X-User-Id'] = userSub;
  else headers['X-Anonymous-Id'] = getOrCreateRsAnonymousId();

  try {
    await fetch(`${environment.apiUrl}/track-site-event`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    // fire-and-forget
  }
}

export async function completeAuthIntentFromPendingStorage(
  userSub?: string
): Promise<void> {
  const pending = readAuthGatePending();
  if (!pending) return;
  clearAuthGatePending();
  await postAuthFunnelSiteEvent(
    {
      eventType: 'auth_intent_completed',
      metadata: {
        entry: pending.entry,
        context: pending.context,
        platform: 'web',
        flag_on: pending.flag_on,
        auth_path: pending.auth_path,
        ms_since_gate_shown: Date.now() - pending.shownAt,
      },
    },
    userSub
  );
}
