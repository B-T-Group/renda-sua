import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../auth0DirectService', () => ({
  default: {
    setActiveRefreshTokenKey: vi.fn(),
    logout: vi.fn(),
    clearSessionTokens: vi.fn(),
  },
}));
vi.mock('../biometric/BiometricService', () => ({
  default: {
    authenticate: vi.fn(),
    isSupported: vi.fn(),
    isEnrolled: vi.fn(),
  },
}));
vi.mock('../savedAccount/SavedAccountService', () => ({
  default: {
    findById: vi.fn(),
    setBiometricEnabled: vi.fn(),
  },
}));
vi.mock('../storage/SecureStorageService', () => ({
  default: {
    isAvailable: () => true,
    getRefreshToken: vi.fn(),
    setRefreshToken: vi.fn(),
  },
}));
vi.mock('../../config/envSwitch', () => ({
  getEffectiveEnv: () => 'prod',
  registerEnvChangeListener: vi.fn(),
}));
vi.mock('../notificationRegistrationService', () => ({
  syncExpoPushTokenWithBackend: vi.fn(),
}));
vi.mock('../../utils/activePersonaStorage', () => ({
  clearActivePersonaStorage: vi.fn(),
}));

import BiometricService from '../biometric/BiometricService';
import SavedAccountService from '../savedAccount/SavedAccountService';
import SecureStorageService from '../storage/SecureStorageService';
import { SessionService } from './SessionService';
import type { SavedAccount } from '../../types/savedAccount';
import type { RootStore } from '../../stores/RootStore';

const account: SavedAccount = {
  id: 'acc-1',
  environment: 'prod',
  userId: 'user-1',
  displayName: 'Ada',
  email: 'ada@example.com',
  lastUsedAt: 1,
  biometricEnabled: false,
  secureStoreKey: 'secure-key',
  createdAt: 1,
};

function createStore(overrides?: {
  activeSavedAccountId?: string | null;
  refreshToken?: string;
}) {
  const auth = {
    activeSavedAccountId:
      overrides && 'activeSavedAccountId' in overrides
        ? overrides.activeSavedAccountId
        : 'acc-1',
    biometricPromptPending: true,
    tokens: { refreshToken: overrides?.refreshToken },
    setBiometricPromptPending(pending: boolean) {
      this.biometricPromptPending = pending;
    },
  };
  return {
    auth,
    savedAccounts: { hydrate: vi.fn(async () => undefined) },
  } as unknown as RootStore;
}

describe('SessionService.enableBiometricsForActiveAccount', () => {
  let service: SessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.mocked(SavedAccountService.findById).mockResolvedValue(account);
    vi.mocked(SavedAccountService.setBiometricEnabled).mockResolvedValue(undefined);
    vi.mocked(BiometricService.authenticate).mockResolvedValue({ ok: true });
    vi.mocked(SecureStorageService.getRefreshToken).mockResolvedValue('rt-stored');
    vi.mocked(SecureStorageService.setRefreshToken).mockResolvedValue(true);
    service = new SessionService();
  });

  it('enables biometrics and dismisses the prompt after Face ID succeeds', async () => {
    const store = createStore();
    service.bind(store);

    const ok = await service.enableBiometricsForActiveAccount();

    expect(ok).toBe(true);
    expect(SavedAccountService.setBiometricEnabled).toHaveBeenCalledWith('acc-1', true);
    expect(SecureStorageService.setRefreshToken).not.toHaveBeenCalled();
    expect(store.auth.biometricPromptPending).toBe(false);
  });

  it('dismisses the prompt even when Face ID is cancelled so the user is not stuck', async () => {
    vi.mocked(BiometricService.authenticate).mockResolvedValue({
      ok: false,
      reason: 'cancelled',
    });
    const store = createStore();
    service.bind(store);

    const ok = await service.enableBiometricsForActiveAccount();

    expect(ok).toBe(false);
    expect(SavedAccountService.setBiometricEnabled).not.toHaveBeenCalled();
    expect(store.auth.biometricPromptPending).toBe(false);
  });

  it('retries SecureStore after Face ID then falls back to the in-memory refresh token', async () => {
    vi.useFakeTimers();
    vi.mocked(SecureStorageService.getRefreshToken)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const store = createStore({ refreshToken: 'rt-memory' });
    service.bind(store);

    const pending = service.enableBiometricsForActiveAccount();
    await vi.advanceTimersByTimeAsync(250);
    const ok = await pending;
    vi.useRealTimers();

    expect(ok).toBe(true);
    expect(SecureStorageService.setRefreshToken).toHaveBeenCalledWith(
      'secure-key',
      'rt-memory'
    );
    expect(SavedAccountService.setBiometricEnabled).toHaveBeenCalledWith('acc-1', true);
    expect(store.auth.biometricPromptPending).toBe(false);
  });

  it('dismisses the prompt when there is no saved account to enable', async () => {
    const store = createStore({ activeSavedAccountId: null });
    service.bind(store);

    const ok = await service.enableBiometricsForActiveAccount();

    expect(ok).toBe(false);
    expect(BiometricService.authenticate).not.toHaveBeenCalled();
    expect(store.auth.biometricPromptPending).toBe(false);
  });

  it('skips a second Face ID prompt when already authenticated', async () => {
    const store = createStore();
    service.bind(store);

    const ok = await service.enableBiometricsForActiveAccount({
      skipAuthentication: true,
    });

    expect(ok).toBe(true);
    expect(BiometricService.authenticate).not.toHaveBeenCalled();
    expect(store.auth.biometricPromptPending).toBe(false);
  });
});
