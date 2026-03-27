import { useAuth0 } from '@auth0/auth0-react';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { environment } from '../config/environment';

type JwtPayload = Record<string, any>;

export interface SessionAuthUser {
  sub: string;
  email?: string;
  email_verified?: boolean;
}

interface PasswordlessSession {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  tokenType: string;
  expiresAtMs: number;
}

interface SessionAuthContextType {
  isAuthenticated: boolean;
  user: any | SessionAuthUser | undefined;
  getAccessToken: () => Promise<string | null>;
  logout: () => Promise<void>;
  setPasswordlessSession: (data: {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
  }) => void;
  clearPasswordlessSession: () => void;
}

const STORAGE_KEYS = {
  accessToken: 'rs_pwls_access_token',
  idToken: 'rs_pwls_id_token',
  refreshToken: 'rs_pwls_refresh_token',
  tokenType: 'rs_pwls_token_type',
  expiresAtMs: 'rs_pwls_expires_at_ms',
} as const;

const SessionAuthContext = createContext<SessionAuthContextType | null>(null);

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

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

function readPasswordlessSession(): PasswordlessSession | null {
  const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
  if (!accessToken) return null;
  const tokenType = localStorage.getItem(STORAGE_KEYS.tokenType) || 'Bearer';
  const idToken = localStorage.getItem(STORAGE_KEYS.idToken) || undefined;
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken) || undefined;
  const expiresAtMs =
    safeJsonParse<number>(localStorage.getItem(STORAGE_KEYS.expiresAtMs)) ||
    0;
  return { accessToken, idToken, refreshToken, tokenType, expiresAtMs };
}

function writePasswordlessSession(session: PasswordlessSession) {
  localStorage.setItem(STORAGE_KEYS.accessToken, session.accessToken);
  localStorage.setItem(STORAGE_KEYS.tokenType, session.tokenType);
  localStorage.setItem(STORAGE_KEYS.expiresAtMs, JSON.stringify(session.expiresAtMs));
  if (session.idToken) localStorage.setItem(STORAGE_KEYS.idToken, session.idToken);
  if (session.refreshToken) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, session.refreshToken);
  }
}

function clearPasswordlessSessionStorage() {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.idToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.tokenType);
  localStorage.removeItem(STORAGE_KEYS.expiresAtMs);
}

async function refreshWithAuth0(refreshToken: string): Promise<{
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}> {
  const res = await fetch(`https://${environment.auth0.domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: environment.auth0.clientId,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to refresh token');
  }
  return (await res.json()) as any;
}

export const SessionAuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const auth0 = useAuth0();

  const [passwordlessSession, setPasswordlessSessionState] =
    useState<PasswordlessSession | null>(() => readPasswordlessSession());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (!Object.values(STORAGE_KEYS).includes(e.key as any)) return;
      setPasswordlessSessionState(readPasswordlessSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const passwordlessUser = useMemo((): SessionAuthUser | undefined => {
    if (!passwordlessSession?.idToken) return undefined;
    const payload = decodeJwtPayload(passwordlessSession.idToken);
    if (!payload?.sub) return undefined;
    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified,
    };
  }, [passwordlessSession?.idToken]);

  const isPasswordlessAuthenticated = useMemo(() => {
    if (!passwordlessSession?.accessToken) return false;
    return passwordlessSession.expiresAtMs > Date.now() + 30_000;
  }, [passwordlessSession]);

  const clearPasswordlessSession = useCallback(() => {
    clearPasswordlessSessionStorage();
    setPasswordlessSessionState(null);
  }, []);

  const setPasswordlessSession = useCallback(
    (data: {
      access_token: string;
      id_token?: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
    }) => {
      const expiresAtMs = Date.now() + (data.expires_in || 0) * 1000;
      writePasswordlessSession({
        accessToken: data.access_token,
        idToken: data.id_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type || 'Bearer',
        expiresAtMs,
      });
      setPasswordlessSessionState(readPasswordlessSession());
    },
    []
  );

  const getAccessToken = useCallback(async () => {
    if (auth0.isAuthenticated && auth0.getAccessTokenSilently) {
      return await auth0.getAccessTokenSilently();
    }

    const session = readPasswordlessSession();
    if (!session) return null;

    if (session.expiresAtMs > Date.now() + 30_000) {
      return session.accessToken;
    }

    if (!session.refreshToken) {
      clearPasswordlessSessionStorage();
      return null;
    }

    const refreshed = await refreshWithAuth0(session.refreshToken);
    setPasswordlessSession(refreshed);
    return refreshed.access_token;
  }, [auth0.isAuthenticated, auth0.getAccessTokenSilently, setPasswordlessSession]);

  const logout = useCallback(async () => {
    clearPasswordlessSessionStorage();
    if (auth0.isAuthenticated && auth0.logout) {
      await auth0.logout({
        logoutParams: { returnTo: window.location.origin },
      } as any);
    }
  }, [auth0.isAuthenticated, auth0.logout]);

  const value: SessionAuthContextType = {
    isAuthenticated: auth0.isAuthenticated || isPasswordlessAuthenticated,
    user: (auth0.user as any) || passwordlessUser,
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

