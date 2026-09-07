import { runInAction } from 'mobx';
import Auth0DirectService from '../auth0DirectService';
import BiometricService from '../biometric/BiometricService';
import SavedAccountService from '../savedAccount/SavedAccountService';
import SecureStorageService from '../storage/SecureStorageService';
import type { RootStore } from '../../stores/RootStore';
import type { AuthTokens, User } from '../../stores/AuthStore';
import type { SavedAccount, SavedAccountPersona } from '../../types/savedAccount';
import { getEffectiveEnv, registerEnvChangeListener } from '../../config/envSwitch';
import { syncExpoPushTokenWithBackend } from '../notificationRegistrationService';
import { clearActivePersonaStorage } from '../../utils/activePersonaStorage';

export type LogoutMode = 'keep' | 'remove';

let envListenerRegistered = false;

export class SessionService {
  private rootStore: RootStore | null = null;

  bind(rootStore: RootStore): void {
    this.rootStore = rootStore;
    if (!envListenerRegistered) {
      envListenerRegistered = true;
      registerEnvChangeListener(() => {
        void this.onEnvironmentChanged();
      });
    }
  }

  private get store(): RootStore {
    if (!this.rootStore) throw new Error('SessionService not bound');
    return this.rootStore;
  }

  async persistRefreshTokenForAccount(
    userId: string,
    refreshToken: string
  ): Promise<string> {
    const secureStoreKey = await SavedAccountService.buildSecureStoreKeyForAccount(
      userId
    );
    await SecureStorageService.setRefreshToken(secureStoreKey, refreshToken);
    await Auth0DirectService.setActiveRefreshTokenKey(secureStoreKey);
    await SavedAccountService.setActiveRefreshTokenKey(secureStoreKey);
    return secureStoreKey;
  }

  async migrateLegacyRefreshToken(
    userId: string,
    refreshToken: string | undefined
  ): Promise<void> {
    if (!refreshToken?.trim()) return;
    const key = await this.persistRefreshTokenForAccount(userId, refreshToken);
    await Auth0DirectService.migrateRefreshTokenOffAsyncStorage(refreshToken, key);
  }

  async completeLogin(params: {
    user: User;
    tokens: AuthTokens;
    persona?: SavedAccountPersona;
  }): Promise<{ account: SavedAccount; shouldPromptBiometrics: boolean }> {
    const { auth, persona } = this.store;
    const activePersona =
      params.persona ??
      (persona.activePersona as SavedAccountPersona | null) ??
      'client';
    const secureStoreKey = await this.resolveLoginSecureStoreKey(
      params.user.id,
      params.tokens.refreshToken
    );
    const account = await SavedAccountService.upsertFromSession({
      user: params.user,
      persona: activePersona,
      secureStoreKey,
    });
    await SavedAccountService.setActiveSavedAccountId(account.id);
    auth.setActiveSavedAccountId(account.id);
    await this.maybePromptBiometrics(account);
    syncExpoPushTokenWithBackend();
    return {
      account,
      shouldPromptBiometrics: this.store.auth.biometricPromptPending,
    };
  }

  private async resolveLoginSecureStoreKey(
    userId: string,
    refreshToken: string | undefined
  ): Promise<string> {
    if (refreshToken) {
      return this.persistRefreshTokenForAccount(userId, refreshToken);
    }
    const secureStoreKey = await SavedAccountService.buildSecureStoreKeyForAccount(
      userId
    );
    await Auth0DirectService.setActiveRefreshTokenKey(secureStoreKey);
    await SavedAccountService.setActiveRefreshTokenKey(secureStoreKey);
    return secureStoreKey;
  }

  private async maybePromptBiometrics(account: SavedAccount): Promise<void> {
    const shouldPrompt =
      SecureStorageService.isAvailable() &&
      !account.biometricEnabled &&
      (await BiometricService.isSupported()) &&
      (await BiometricService.isEnrolled());
    if (shouldPrompt) {
      this.store.auth.setBiometricPromptPending(true);
    }
  }

  async enableBiometricsForActiveAccount(): Promise<boolean> {
    const { auth, savedAccounts } = this.store;
    const accountId = auth.activeSavedAccountId;
    if (!accountId) return false;

    const account = await SavedAccountService.findById(accountId);
    if (!account) return false;

    const bio = await BiometricService.authenticate(
      `Enable sign in for ${account.displayName}`
    );
    if (!bio.ok) return false;

    const refreshToken = await SecureStorageService.getRefreshToken(account.secureStoreKey);
    if (!refreshToken) return false;

    const ok = await SecureStorageService.setRefreshToken(account.secureStoreKey, refreshToken);
    if (!ok) return false;

    await SavedAccountService.setBiometricEnabled(accountId, true);
    await savedAccounts.hydrate();
    auth.setBiometricPromptPending(false);
    return true;
  }

  async disableBiometricsForAccount(accountId: string): Promise<void> {
    const account = await SavedAccountService.findById(accountId);
    if (!account) return;

    const token = await SecureStorageService.getRefreshToken(account.secureStoreKey);
    if (token) {
      await SecureStorageService.setRefreshToken(account.secureStoreKey, token);
    }
    await SavedAccountService.setBiometricEnabled(accountId, false);
    await this.store.savedAccounts.hydrate();
  }

  dismissBiometricPrompt(): void {
    this.store.auth.setBiometricPromptPending(false);
  }

  async authenticateForAccount(
    account: SavedAccount
  ): Promise<{ ok: true; account: SavedAccount } | { ok: false; reason: string }> {
    const migrated = await SavedAccountService.migrateAccountSecureStoreKey(account);

    if (migrated.biometricEnabled) {
      const bio = await BiometricService.authenticate(`Unlock ${migrated.displayName}`);
      if (!bio.ok) {
        if (bio.reason === 'enrollment_changed') {
          await SavedAccountService.setBiometricEnabled(migrated.id, false);
          await SecureStorageService.deleteRefreshToken(migrated.secureStoreKey);
          await this.store.savedAccounts.hydrate();
        }
        return { ok: false, reason: bio.reason };
      }
    }

    const refreshToken = await SecureStorageService.getRefreshToken(migrated.secureStoreKey);
    if (!refreshToken) {
      return { ok: false, reason: 'no_refresh_token' };
    }

    await Auth0DirectService.setActiveRefreshTokenKey(migrated.secureStoreKey);
    await SavedAccountService.setActiveRefreshTokenKey(migrated.secureStoreKey);
    return { ok: true, account: migrated };
  }

  async clearDeadRefreshTokenForAccount(account: SavedAccount): Promise<void> {
    await SecureStorageService.deleteRefreshToken(account.secureStoreKey);
  }

  async clearDeadRefreshTokenForActiveAccount(): Promise<void> {
    const accountId = this.store.auth.activeSavedAccountId;
    if (!accountId) return;
    const account = await SavedAccountService.findById(accountId);
    if (!account) return;
    await this.clearDeadRefreshTokenForAccount(account);
  }

  private markSignInRequired(): void {
    runInAction(() => {
      this.store.auth.isLoading = false;
      this.store.auth.error = 'savedAccounts.errors.signInRequired';
    });
  }

  async signInWithSavedAccount(accountId: string): Promise<boolean> {
    const { auth, persona } = this.store;
    const account = await SavedAccountService.findById(accountId);
    if (!account) return false;

    const gate = await this.authenticateForAccount(account);
    if (!gate.ok) {
      if (gate.reason === 'no_refresh_token') {
        await this.clearDeadRefreshTokenForAccount(account);
        this.markSignInRequired();
      }
      return false;
    }

    runInAction(() => {
      auth.isLoading = true;
      auth.error = null;
    });
    return this.refreshAndFinishSignIn(gate.account, persona);
  }

  private async refreshAndFinishSignIn(
    account: SavedAccount,
    persona: RootStore['persona']
  ): Promise<boolean> {
    const result = await Auth0DirectService.refreshAccessTokenDetailed(
      account.persona ? { active_persona: account.persona } : undefined
    );
    if (!result.ok) {
      if (result.reason === 'invalid_grant' || result.reason === 'no_refresh_token') {
        await this.clearDeadRefreshTokenForAccount(account);
        this.markSignInRequired();
      } else {
        runInAction(() => {
          this.store.auth.isLoading = false;
          this.store.auth.error = 'savedAccounts.errors.network';
        });
      }
      return false;
    }
    return this.finishSavedAccountSignIn(account, result.tokens, persona);
  }

  private async finishSavedAccountSignIn(
    account: SavedAccount,
    tokens: { access_token: string; expires_in: number },
    persona: RootStore['persona']
  ): Promise<boolean> {
    const { auth } = this.store;
    let userInfo;
    try {
      userInfo = await Auth0DirectService.getUserInfo(tokens.access_token);
    } catch {
      runInAction(() => {
        auth.isLoading = false;
      });
      return false;
    }

    const user = auth.mapAuth0UserToUser(userInfo);
    await auth.establishSession(user, {
      accessToken: tokens.access_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    });
    await SavedAccountService.setActiveSavedAccountId(account.id);
    auth.setActiveSavedAccountId(account.id);
    await SavedAccountService.touchLastUsed(account.id);
    await this.store.savedAccounts.hydrate();
    void persona.ensureSession();

    runInAction(() => {
      auth.isLoading = false;
    });
    syncExpoPushTokenWithBackend();
    return true;
  }

  async switchAccount(accountId: string): Promise<boolean> {
    await this.clearActiveSessionOnly();
    return this.signInWithSavedAccount(accountId);
  }

  async logout(mode: LogoutMode, accountId?: string): Promise<void> {
    const { auth } = this.store;
    const targetId = accountId ?? auth.activeSavedAccountId;

    if (mode === 'remove' && targetId) {
      const account = await SavedAccountService.findById(targetId);
      if (account) {
        await SecureStorageService.deleteRefreshToken(account.secureStoreKey);
        await SavedAccountService.remove(targetId);
      }
    }

    await Auth0DirectService.logout({ preserveRefreshToken: mode === 'keep' });
    await auth.clearSessionOnly();
    this.store.reset();
    await this.clearActiveAccountPointers();

    await this.store.savedAccounts.hydrate();
  }

  async clearActiveSessionOnly(): Promise<void> {
    await Auth0DirectService.clearSessionTokens();
    await clearActivePersonaStorage();
    await this.store.auth.clearSessionOnly();
  }

  private async clearActiveAccountPointers(): Promise<void> {
    await SavedAccountService.setActiveSavedAccountId(null);
    await SavedAccountService.setActiveRefreshTokenKey(null);
    await Auth0DirectService.setActiveRefreshTokenKey(null);
    this.store.auth.setActiveSavedAccountId(null);
  }

  async onEnvironmentChanged(): Promise<void> {
    if (!this.rootStore) return;
    if (!this.rootStore.auth.isAuthenticated) {
      await this.clearActiveAccountPointers();
      await this.rootStore.savedAccounts.hydrate();
      return;
    }
    await this.logout('keep');
  }

  async migrateExistingSessionOnHydrate(): Promise<void> {
    const { auth } = this.store;
    if (!auth.isAuthenticated || !auth.user || !auth.tokens) return;

    const persona = (this.store.persona.activePersona ?? 'client') as SavedAccountPersona;
    const refreshToken =
      auth.tokens.refreshToken ??
      (await Auth0DirectService.getLegacyRefreshTokenFromAsyncStorage());

    if (refreshToken) {
      await this.migrateLegacyRefreshToken(auth.user.id, refreshToken);
    }

    const secureStoreKey = await this.resolveHydrateSecureStoreKey(auth.user.id);
    const account = await SavedAccountService.upsertFromSession({
      user: auth.user,
      persona,
      secureStoreKey,
      biometricEnabled: false,
    });
    const migrated = await SavedAccountService.migrateAccountSecureStoreKey(account);

    auth.setActiveSavedAccountId(migrated.id);
    await SavedAccountService.setActiveSavedAccountId(migrated.id);
  }

  /** Migrate any existing saved-account row before upsert overwrites its key. */
  private async resolveHydrateSecureStoreKey(userId: string): Promise<string> {
    const existing = await SavedAccountService.findByComposite(
      getEffectiveEnv(),
      userId
    );
    if (existing) {
      const migrated = await SavedAccountService.migrateAccountSecureStoreKey(existing);
      return migrated.secureStoreKey;
    }
    return SavedAccountService.buildSecureStoreKeyForAccount(userId);
  }
}

export default new SessionService();
