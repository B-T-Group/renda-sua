jest.unmock('./AuthGateContext');

import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { AuthGateProvider, useAuthGate } from './AuthGateContext';

jest.mock('../hooks/useClientFlags', () => ({
  useClientFlags: () => ({ flags: { auth_web_inapp_gates: true } }),
}));

jest.mock('../hooks/useAuthFunnelTracking', () => ({
  useAuthFunnelTracking: () => ({
    trackAuthGateShown: jest.fn(),
    trackAuthGateDismissed: jest.fn(),
  }),
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, def: string) => def }),
}));

jest.mock('../components/auth/AuthGate', () => ({
  __esModule: true,
  default: () => null,
}));

const mockSessionAuth = {
  isAuthenticated: false,
  setPasswordlessSession: jest.fn(),
  user: undefined,
};

jest.mock('./SessionAuthContext', () => ({
  useSessionAuth: () => mockSessionAuth,
}));

describe('useAuthGate', () => {
  beforeEach(() => {
    mockSessionAuth.isAuthenticated = false;
    jest.clearAllMocks();
  });

  it('resolves true immediately when already authenticated', async () => {
    mockSessionAuth.isAuthenticated = true;
    const run = jest.fn();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthGateProvider>{children}</AuthGateProvider>
    );
    const { result } = renderHook(() => useAuthGate(), { wrapper });
    await act(async () => {
      const ok = await result.current.requireAuth({
        context: 'favorites',
        entry: 'save_favorites',
        run,
      });
      expect(ok).toBe(true);
    });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
