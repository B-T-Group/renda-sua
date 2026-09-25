import { useAuth0 } from '@auth0/auth0-react';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { environment } from '../config/environment';
import { personaAuthorizationParams } from '../services/tokenService';
import { readStoredActivePersonaSlug } from '../utils/activePersonaStorage';

type JwtPayload = Record<string, any>;

export interface SessionAuthUser {
  sub: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  first_name?: string;
  last_name?: string;
  picture?: string;
  phone_number?: string;
  [key: string]: unknown;
}

interface SessionAuthContextType {
  isAuthenticated: boolean;
  isSessionReady: boolean;
  isLoading: boolean;
  user: SessionAuthUser | undefined;
  getAccessToken: (options?: {
    refresh?: boolean;
    force?: boolean;
    persona?: string | null;
  }) => Promise<string | null>;
  logout: () => Promise<void>;
  setPasswordlessSession: (data: {
    access_token: string;
    id_token?: string;
    token_type: string;
    expires_in: number;
  }) => void;
  clearPasswordlessSession: () => void;
}

const SessionAuthContext = createContext<SessionAuthContextType | null>(null);

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

type RefreshBackendOpts = { force?: boolean; persona?: string | null };

function buildRefreshBodyJson(opts?: RefreshBackendOpts): string | undefined {
  const stored = readStoredActivePersonaSlug();
  const persona =
    opts?.persona !== undefined ? opts.persona ?? stored : stored;
  const payload: Record<string, unknown> = {};
  if (persona) payload.active_persona = persona;
  if (opts?.force || opts?.persona !== undefined) payload.force = true;
  if (!Object.keys(payload).length) return undefined;
  return JSON.stringify(payload);
}

function refreshInflightKey(opts?: RefreshBackendOpts): string {
  const stored = readStoredActivePersonaSlug() ?? '';
  const persona =
    opts?.persona !== undefined ? opts.persona ?? stored : stored;
  const force = opts?.force || opts?.persona !== undefined ? '1' : '0';
  return `${persona}:${force}`;
}

async function fetchRefresh(
  retried: boolean,
  bodyJson?: string
): Promise<Response | null> {
  const res = await fetch(`${environment.apiUrl}/auth/login/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'web',
      'X-Requested-With': 'XMLHttpRequest',
    },
    ...(bodyJson ? { body: bodyJson } : {}),
  });
  if (res.ok) return res;
  if ((res.status === 429 || res.status === 503) && !retried) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return fetchRefresh(true, bodyJson);
  }
  if (res.status === 401) return null;
  throw new Error('Failed to refresh token');
}

const inflightRefreshes = new Map<
  string,
  Promise<{
    access_token: string;
    id_token?: string;
    token_type: string;
    expires_in: number;
  } | null>
>();

async function refreshWithBackend(opts?: RefreshBackendOpts) {
  const bodyJson = buildRefreshBodyJson(opts);
  try {
    const res = await fetchRefresh(false, bodyJson);
    if (!res) return null;
    return (await res.json()) as {
      access_token: string;
      id_token?: string;
      token_type: string;
      expires_in: number;
    };
  } catch {
    return null;
  }
}

function refreshSessionOnce(opts?: RefreshBackendOpts) {
  const key = refreshInflightKey(opts);
  let inflight = inflightRefreshes.get(key);
  if (!inflight) {
    inflight = refreshWithBackend(opts).finally(() => {
      inflightRefreshes.delete(key);
    });
    inflightRefreshes.set(key, inflight);
  }
  return inflight;
}

export const SessionAuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const auth0 = useAuth0();

  // Memory-only passwordless session (no localStorage)
  const [passwordlessAccessToken, setPasswordlessAccessToken] = useState<string | null>(null);
  const [passwordlessIdToken, setPasswordlessIdToken] = useState<string | null>(null);
  const [passwordlessExpiresAtMs, setPasswordlessExpiresAtMs] = useState<number>(0);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const passwordlessAccessTokenRef = useRef<string | null>(null);
  const passwordlessExpiresAtMsRef = useRef(0);

  const applyPasswordlessTokens = useCallback(
    (data: {
      access_token: string;
      id_token?: string;
      token_type: string;
      expires_in: number;
    }) => {
      const expiresAtMs = Date.now() + (data.expires_in || 0) * 1000;
      passwordlessAccessTokenRef.current = data.access_token;
      passwordlessExpiresAtMsRef.current = expiresAtMs;
      setPasswordlessAccessToken(data.access_token);
      setPasswordlessIdToken(data.id_token || null);
      setPasswordlessExpiresAtMs(expiresAtMs);
    },
    []
  );

  // Hydrate session from cookie on mount
  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      const refreshed = await refreshSessionOnce();
      if (!isMounted) return;
      if (refreshed) applyPasswordlessTokens(refreshed);
      setIsSessionReady(true);
    };

    void hydrateSession();

    return () => {
      isMounted = false;
    };
  }, [applyPasswordlessTokens]);

  const passwordlessUser = useMemo((): SessionAuthUser | undefined => {
    if (!passwordlessIdToken) return undefined;
    const payload = decodeJwtPayload(passwordlessIdToken);
    if (!payload?.sub || typeof payload.sub !== 'string') return undefined;
    return {
      ...payload,
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      email_verified:
        typeof payload.email_verified === 'boolean'
          ? payload.email_verified
          : undefined,
    };
  }, [passwordlessIdToken]);

  const isPasswordlessAuthenticated = useMemo(() => {
    if (!passwordlessAccessToken) return false;
    return passwordlessExpiresAtMs > Date.now() + 30_000;
  }, [passwordlessAccessToken, passwordlessExpiresAtMs]);

  const isLoading = useMemo(
    () =>
      auth0.isLoading || (!auth0.isAuthenticated && !isSessionReady),
    [auth0.isLoading, auth0.isAuthenticated, isSessionReady]
  );

  const clearPasswordlessSession = useCallback(() => {
    passwordlessAccessTokenRef.current = null;
    passwordlessExpiresAtMsRef.current = 0;
    setPasswordlessAccessToken(null);
    setPasswordlessIdToken(null);
    setPasswordlessExpiresAtMs(0);
  }, []);

  const setPasswordlessSession = useCallback(
    (data: {
      access_token: string;
      id_token?: string;
      token_type: string;
      expires_in: number;
    }) => {
      applyPasswordlessTokens(data);
    },
    [applyPasswordlessTokens]
  );

  const getAccessToken = useCallback(
    async (options?: {
      refresh?: boolean;
      force?: boolean;
      persona?: string | null;
    }) => {
      if (auth0.isAuthenticated && auth0.getAccessTokenSilently) {
        const storedPersona = readStoredActivePersonaSlug();
        const persona =
          options?.persona !== undefined
            ? options.persona ?? storedPersona
            : storedPersona;
        if (options?.force || options?.persona !== undefined) {
          return await auth0.getAccessTokenSilently({
            cacheMode: 'off',
            ...(persona
              ? { authorizationParams: { active_persona: persona } }
              : {}),
          });
        }
        return await auth0.getAccessTokenSilently(personaAuthorizationParams());
      }

      const token = passwordlessAccessTokenRef.current;
      const expiresAtMs = passwordlessExpiresAtMsRef.current;
      const needsForcedRefresh =
        options?.force === true || options?.persona !== undefined;
      if (
        token &&
        expiresAtMs > Date.now() + 30_000 &&
        !needsForcedRefresh
      ) {
        return token;
      }
      if (options?.refresh === false) return null;

      const refreshed = await refreshSessionOnce({
        force: options?.force,
        persona: options?.persona,
      });
      if (!refreshed) {
        clearPasswordlessSession();
        return null;
      }

      applyPasswordlessTokens(refreshed);
      return refreshed.access_token;
    },
    [
      auth0.isAuthenticated,
      auth0.getAccessTokenSilently,
      applyPasswordlessTokens,
      clearPasswordlessSession,
    ]
  );

  const logout = useCallback(async () => {
    clearPasswordlessSession();
    // Call backend logout to clear session cookie
    try {
      await fetch(`${environment.apiUrl}/auth/login/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Client-Platform': 'web',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
    } catch {
      // Ignore logout errors
    }
    if (auth0.isAuthenticated && auth0.logout) {
      await auth0.logout({
        logoutParams: { returnTo: window.location.origin },
      } as any);
    }
  }, [auth0.isAuthenticated, auth0.logout, clearPasswordlessSession]);

  const value: SessionAuthContextType = {
    isAuthenticated: auth0.isAuthenticated || isPasswordlessAuthenticated,
    isSessionReady: auth0.isAuthenticated || isSessionReady,
    isLoading,
    user: (auth0.user as SessionAuthUser | undefined) || passwordlessUser,
    getAccessToken,
    logout,
    setPasswordlessSession,
    clearPasswordlessSession,
  };

  return (
    <SessionAuthContext.Provider value={value}>
      {children}
    </SessionAuthContext.Provider>
  );
};

export const useSessionAuth = (): SessionAuthContextType => {
  const ctx = useContext(SessionAuthContext);
  if (!ctx) {
    throw new Error('useSessionAuth must be used within SessionAuthProvider');
  }
  return ctx;
};
