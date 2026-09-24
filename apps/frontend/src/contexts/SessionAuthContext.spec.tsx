import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  SessionAuthProvider,
  useSessionAuth,
} from './SessionAuthContext';

jest.unmock('./SessionAuthContext');

const mockUseAuth0 = jest.fn();

jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => mockUseAuth0(),
}));

jest.mock('../config/environment', () => ({
  environment: { apiUrl: 'https://dev.api.rendasua.com/api' },
}));

jest.mock('../services/tokenService', () => ({
  personaAuthorizationParams: () => ({}),
}));

function encodeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe('SessionAuthContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionAuthProvider>{children}</SessionAuthProvider>
  );

  beforeEach(() => {
    mockUseAuth0.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: undefined,
      getAccessTokenSilently: jest.fn(),
      logout: jest.fn(),
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('isLoading is true until cookie refresh settles, then false', async () => {
    let resolveRefresh: (value: unknown) => void = () => undefined;
    (global.fetch as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const { result } = renderHook(() => useSessionAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveRefresh({ ok: false, status: 401 });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('exposes passwordless user with custom claims from id_token', async () => {
    const idToken = encodeJwt({
      sub: 'auth0|pwless',
      email: 'user@rendasua-test.com',
      email_verified: true,
      given_name: 'Ada',
      family_name: 'Lovelace',
      'https://groupe-bt.com/first_login': true,
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'at',
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    const { result } = renderHook(() => useSessionAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user?.sub).toBe('auth0|pwless');
    expect(result.current.user?.email).toBe('user@rendasua-test.com');
    expect(result.current.user?.given_name).toBe('Ada');
    expect(result.current.user?.['https://groupe-bt.com/first_login']).toBe(
      true
    );
    expect(result.current.isLoading).toBe(false);
  });

  it('prefers Auth0 SPA user when authenticated via Auth0', async () => {
    mockUseAuth0.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { sub: 'auth0|spa', email: 'spa@example.com' },
      getAccessTokenSilently: jest.fn(),
      logout: jest.fn(),
    });

    const { result } = renderHook(() => useSessionAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user?.sub).toBe('auth0|spa');
    expect(result.current.isLoading).toBe(false);
  });
});
