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
import { personaAuthorizationParams } from '../services/tokenService';

type JwtPayload = Record<string, any>;

export interface SessionAuthUser {
  sub: string;
  email?: string;
  email_verified?: boolean;
}

interface SessionAuthContextType {
  isAuthenticated: boolean;
  user: any | SessionAuthUser | undefined;
  getAccessToken: () => Promise<string | null>;
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

async function refreshWithBackend(): Promise<{
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
} | null> {
  try {
    const res = await fetch(`${environment.apiUrl}/auth/login/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'web',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!res.ok) {
      if (res.status === 401) {
        return null;
      }
      throw new Error('Failed to refresh token');
    }
    return (await res.json()) as any;
  } catch {
    return null;
  }
}

export const SessionAuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const auth0 = useAuth0();

  // Memory-only passwordless session (no localStorage)
  const [passwordlessAccessToken, setPasswordlessAccessToken] = useState<string | null>(null);
  const [passwordlessIdToken, setPasswordlessIdToken] = useState<string | null>(null);
  const [passwordlessTokenType, setPasswordlessTokenType] = useState<string>('Bearer');
  const [passwordlessExpiresAtMs, setPasswordlessExpiresAtMs] = useState<number>(0);
  const [isHydrating, setIsHydrating] = useState(true);

  // Hydrate session from cookie on mount
  useEffect(() => {
    let isMounted = true;
    
    const hydrateSession = async () => {
      try {
        const refreshed = await refreshWithBackend();
        if (refreshed && isMounted) {
          setPasswordlessAccessToken(refreshed.access_token);
          setPasswordlessIdToken(refreshed.id_token);
          setPasswordlessTokenType(refreshed.token_type || 'Bearer');
          setPasswordlessExpiresAtMs(Date.now() + (refreshed.expires_in || 0) * 1000);
        }
      } catch {
        // Cookie not present or invalid - user is logged out
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    };

    void hydrateSession();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const passwordlessUser = useMemo((): SessionAuthUser | undefined => {
    if (!passwordlessIdToken) return undefined;
    const payload = decodeJwtPayload(passwordlessIdToken);
    if (!payload?.sub) return undefined;
    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified,
    };
  }, [passwordlessIdToken]);

  const isPasswordlessAuthenticated = useMemo(() => {
    if (!passwordlessAccessToken) return false;
    return passwordlessExpiresAtMs > Date.now() + 30_000;
  }, [passwordlessAccessToken, passwordlessExpiresAtMs]);

  const clearPasswordlessSession = useCallback(() => {
    setPasswordlessAccessToken(null);
    setPasswordlessIdToken(null);
    setPasswordlessTokenType('Bearer');
    setPasswordlessExpiresAtMs(0);
  }, []);

  const setPasswordlessSession = useCallback(
    (data: {
      access_token: string;
      id_token?: string;
      token_type: string;
      expires_in: number;
    }) => {
      const expiresAtMs = Date.now() + (data.expires_in || 0) * 1000;
      setPasswordlessAccessToken(data.access_token);
      setPasswordlessIdToken(data.id_token || null);
      setPasswordlessTokenType(data.token_type || 'Bearer');
      setPasswordlessExpiresAtMs(expiresAtMs);
    },
    []
  );

  const getAccessToken = useCallback(async () => {
    if (auth0.isAuthenticated && auth0.getAccessTokenSilently) {
      return await auth0.getAccessTokenSilently(personaAuthorizationParams());
    }

    if (!passwordlessAccessToken) return null;

    if (passwordlessExpiresAtMs > Date.now() + 30_000) {
      return passwordlessAccessToken;
    }

    const refreshed = await refreshWithBackend();
    if (!refreshed) {
      clearPasswordlessSession();
      return null;
    }

    setPasswordlessSession(refreshed);
    return refreshed.access_token;
  }, [auth0.isAuthenticated, auth0.getAccessTokenSilently, passwordlessAccessToken, passwordlessExpiresAtMs, setPasswordlessSession, clearPasswordlessSession]);

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
    isAuthenticated: auth0.isAuthenticated || (isPasswordlessAuthenticated && !isHydrating),
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

