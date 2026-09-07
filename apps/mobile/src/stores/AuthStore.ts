/**
 * Store d'authentification Rendasua Agent (MobX).
 * Login / signup / logout avec auth0DirectService, persistance AsyncStorage @RendasuaAgent:*.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeAutoObservable, runInAction } from 'mobx';
import type { RootStore } from './RootStore';
import Auth0DirectService, {
  Auth0User,
  Auth0Tokens,
  SignupData,
} from '../services/auth0DirectService';
import {
  startLoginOtpEmail,
  startLoginOtpSms,
  verifyLoginOtpEmail,
  verifyLoginOtpSms,
} from '../services/rendasuaLoginOtpService';
import { verifySignupOtp } from '../services/rendasuaSignupOtpService';
import type { SignupLaunchPromo } from '../services/publicAuthApi';
import { syncExpoPushTokenWithBackend } from '../services/notificationRegistrationService';
import SessionService from '../services/session/SessionService';
import SavedAccountService from '../services/savedAccount/SavedAccountService';
import StorageService from '../services/storage/StorageService';
import { STORAGE_KEYS as APP_STORAGE_KEYS } from '../constants/storageKeys';

const STORAGE_PREFIX = '@RendasuaAgent:';
const STORAGE_KEYS = {
  user: `${STORAGE_PREFIX}user`,
  tokens: `${STORAGE_PREFIX}tokens`,
  isAuthenticated: `${STORAGE_PREFIX}isAuthenticated`,
  profilePhotoUri: `${STORAGE_PREFIX}profilePhotoUri`,
  postAuthResumeInventoryItemId: `${STORAGE_PREFIX}postAuthResumeInventoryItemId`,
  postAuthResumeInventoryDetailId: `${STORAGE_PREFIX}postAuthResumeInventoryDetailId`,
  postAuthResumeCartCheckout: `${STORAGE_PREFIX}postAuthResumeCartCheckout`,
  postAuthResumeLikeItemId: `${STORAGE_PREFIX}postAuthResumeLikeItemId`,
};

export interface User {
  id: string;
  /** Vide si compte téléphone uniquement (passwordless). */
  email: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  email_verified?: boolean;
  picture?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export class AuthStore {
  private rootStore: RootStore;

  isAuthenticated = false;
  isLoading = false;
  user: User | null = null;
  tokens: AuthTokens | null = null;
  /** URI de la photo de profil choisie localement (galerie / appareil). Prioritaire sur user.picture. */
  localProfilePhotoUri: string | null = null;
  error: string | null = null;
  /** After guest checkout / login, open this catalog item on the client stack once. */
  postAuthResumeInventoryItemId: string | null = null;
  /** After login from interest CTA, open InventoryItemDetail (not PlaceOrder). */
  postAuthResumeInventoryDetailId: string | null = null;
  /** After guest signs in from cart checkout, open CartCheckout once. */
  postAuthResumeCartCheckout = false;
  /** After guest taps like then signs in, persist this catalog item like once. */
  postAuthResumeLikeItemId: string | null = null;
  /** Shown once after signup OTP; not persisted. */
  signupWelcomePending = false;
  signupWelcomePersona: 'client' | 'agent' | 'business' | null = null;
  signupLaunchPromo: {
    status: string;
    ordersRemaining: number;
    businessLimit: number | null;
    zeroCommissionOrders: number | null;
    identificationWindowDays: number | null;
  } | null = null;
  /** Saved account id for the active session. */
  activeSavedAccountId: string | null = null;
  /** Prompt to enable Face ID / fingerprint after OTP login. */
  biometricPromptPending = false;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);
  }

  private schedulePushTokenRegistration(): void {
    void syncExpoPushTokenWithBackend();
  }

  clearError(): void {
    this.error = null;
  }

  private persistSignupWelcome(): void {
    const hasWelcome =
      this.signupWelcomePending ||
      this.signupWelcomePersona != null ||
      this.signupLaunchPromo != null;
    if (!hasWelcome) {
      void StorageService.remove(APP_STORAGE_KEYS.pendingSignupWelcome);
      return;
    }
    void StorageService.setObject(APP_STORAGE_KEYS.pendingSignupWelcome, {
      pending: this.signupWelcomePending,
      persona: this.signupWelcomePersona,
      launchPromo: this.signupLaunchPromo,
    });
  }

  setSignupWelcomePending(): void {
    this.signupWelcomePending = true;
    this.persistSignupWelcome();
  }

  setSignupWelcomePersona(persona: 'client' | 'agent' | 'business'): void {
    this.signupWelcomePersona = persona;
    this.persistSignupWelcome();
  }

  setSignupLaunchPromo(
    promo: AuthStore['signupLaunchPromo']
  ): void {
    this.signupLaunchPromo = promo;
    this.persistSignupWelcome();
  }

  dismissSignupWelcome(): void {
    this.signupWelcomePending = false;
    this.signupWelcomePersona = null;
    this.signupLaunchPromo = null;
    void StorageService.remove(APP_STORAGE_KEYS.pendingSignupWelcome);
  }

  setActiveSavedAccountId(id: string | null): void {
    this.activeSavedAccountId = id;
  }

  setBiometricPromptPending(pending: boolean): void {
    this.biometricPromptPending = pending;
  }

  async setPostAuthResumeForInventoryItem(inventoryItemId: string): Promise<void> {
    const id = inventoryItemId.trim();
    if (!id) return;
    runInAction(() => {
      this.postAuthResumeInventoryItemId = id;
      this.postAuthResumeInventoryDetailId = null;
      this.postAuthResumeCartCheckout = false;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.postAuthResumeInventoryItemId, id);
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.postAuthResumeInventoryDetailId,
      STORAGE_KEYS.postAuthResumeCartCheckout,
    ]);
  }

  async setPostAuthResumeForInventoryDetail(
    inventoryItemId: string
  ): Promise<void> {
    const id = inventoryItemId.trim();
    if (!id) return;
    runInAction(() => {
      this.postAuthResumeInventoryDetailId = id;
      this.postAuthResumeInventoryItemId = null;
      this.postAuthResumeCartCheckout = false;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.postAuthResumeInventoryDetailId, id);
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.postAuthResumeInventoryItemId,
      STORAGE_KEYS.postAuthResumeCartCheckout,
    ]);
  }

  async setPostAuthResumeForCartCheckout(): Promise<void> {
    runInAction(() => {
      this.postAuthResumeCartCheckout = true;
      this.postAuthResumeInventoryItemId = null;
      this.postAuthResumeInventoryDetailId = null;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.postAuthResumeCartCheckout, '1');
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.postAuthResumeInventoryItemId,
      STORAGE_KEYS.postAuthResumeInventoryDetailId,
    ]);
  }

  consumePostAuthResumeForCartCheckout(): boolean {
    const v = this.postAuthResumeCartCheckout;
    runInAction(() => {
      this.postAuthResumeCartCheckout = false;
    });
    void AsyncStorage.removeItem(STORAGE_KEYS.postAuthResumeCartCheckout);
    return v;
  }

  consumePostAuthResumeForInventoryItem(): string | null {
    const id = this.postAuthResumeInventoryItemId?.trim() || null;
    runInAction(() => {
      this.postAuthResumeInventoryItemId = null;
    });
    void AsyncStorage.removeItem(STORAGE_KEYS.postAuthResumeInventoryItemId);
    return id;
  }

  consumePostAuthResumeForInventoryDetail(): string | null {
    const id = this.postAuthResumeInventoryDetailId?.trim() || null;
    runInAction(() => {
      this.postAuthResumeInventoryDetailId = null;
    });
    void AsyncStorage.removeItem(STORAGE_KEYS.postAuthResumeInventoryDetailId);
    return id;
  }

  async setPostAuthResumeForLikeItem(itemId: string): Promise<void> {
    const id = itemId.trim();
    if (!id) return;
    runInAction(() => {
      this.postAuthResumeLikeItemId = id;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.postAuthResumeLikeItemId, id);
  }

  consumePostAuthResumeForLikeItem(): string | null {
    const id = this.postAuthResumeLikeItemId?.trim() || null;
    runInAction(() => {
      this.postAuthResumeLikeItemId = null;
    });
    void AsyncStorage.removeItem(STORAGE_KEYS.postAuthResumeLikeItemId);
    return id;
  }

  private async loadPostAuthResumeFromStorage(): Promise<void> {
    try {
      const [rawItem, rawDetail, rawCart, rawLike] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.postAuthResumeInventoryItemId),
        AsyncStorage.getItem(STORAGE_KEYS.postAuthResumeInventoryDetailId),
        AsyncStorage.getItem(STORAGE_KEYS.postAuthResumeCartCheckout),
        AsyncStorage.getItem(STORAGE_KEYS.postAuthResumeLikeItemId),
      ]);
      const cart = rawCart === '1';
      const id = rawItem?.trim() || null;
      const detailId = rawDetail?.trim() || null;
      const likeId = rawLike?.trim() || null;
      runInAction(() => {
        if (cart) {
          this.postAuthResumeCartCheckout = true;
          this.postAuthResumeInventoryItemId = null;
          this.postAuthResumeInventoryDetailId = null;
        } else if (detailId) {
          this.postAuthResumeInventoryDetailId = detailId;
          this.postAuthResumeInventoryItemId = null;
          this.postAuthResumeCartCheckout = false;
        } else if (id) {
          this.postAuthResumeInventoryItemId = id;
          this.postAuthResumeInventoryDetailId = null;
          this.postAuthResumeCartCheckout = false;
        }
        this.postAuthResumeLikeItemId = likeId;
      });
    } catch {
      /* ignore */
    }
  }

  async reloadPostAuthResumeFromStorage(): Promise<void> {
    await this.loadPostAuthResumeFromStorage();
  }

  mapAuth0UserToUser(user: Auth0User): User {
    const email = user.email?.trim() ?? '';
    const phoneNumber = user.phone_number?.trim() || undefined;
    return {
      id: user.sub,
      email,
      phoneNumber,
      firstName: user.given_name,
      lastName: user.family_name,
      role: 'agent',
      email_verified: user.email_verified,
      picture: user.picture,
    };
  }

  private async finalizeSuccessfulLogin(user: User, tokens: AuthTokens): Promise<void> {
    runInAction(() => {
      this.user = user;
      this.tokens = tokens;
      this.isAuthenticated = true;
      this.isLoading = false;
    });

    await this.persistAuth();
    await this.reloadPostAuthResumeFromStorage();
    await SessionService.completeLogin({ user, tokens });
    this.schedulePushTokenRegistration();
    this.flushPendingLike();
  }

  private flushPendingLike(): void {
    const likeItemId = this.postAuthResumeLikeItemId?.trim();
    if (!likeItemId) return;
    void import('../services/itemLikesApi').then(({ setItemLike }) => {
      void setItemLike(likeItemId, true)
        .then(() => {
          this.consumePostAuthResumeForLikeItem();
        })
        .catch(() => {
          // Keep pending id for a later successful session resume.
        });
    });
  }

  async establishSession(user: User, tokens: AuthTokens): Promise<void> {
    runInAction(() => {
      this.user = user;
      this.tokens = tokens;
      this.isAuthenticated = true;
      this.error = null;
    });
    await Auth0DirectService.syncSessionUserAndAccessToken({
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
      user: {
        sub: user.id,
        email: user.email,
        phone_number: user.phoneNumber,
        given_name: user.firstName,
        family_name: user.lastName,
        picture: user.picture,
        email_verified: user.email_verified,
      },
    });
    await this.persistAuth();
    this.flushPendingLike();
  }

  async clearSessionOnly(): Promise<void> {
    runInAction(() => {
      this.user = null;
      this.tokens = null;
      this.localProfilePhotoUri = null;
      this.isAuthenticated = false;
      this.isLoading = false;
      this.error = null;
      this.postAuthResumeInventoryItemId = null;
      this.postAuthResumeInventoryDetailId = null;
      this.postAuthResumeCartCheckout = false;
      this.postAuthResumeLikeItemId = null;
      this.signupWelcomePending = false;
      this.signupWelcomePersona = null;
      this.signupLaunchPromo = null;
      this.biometricPromptPending = false;
    });
    await StorageService.remove(APP_STORAGE_KEYS.pendingSignupWelcome);
    await this.clearPersistedAuth();
  }

  async loginWithCredentials(email: string, password: string): Promise<boolean> {
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      const result = await Auth0DirectService.loginWithCredentials(email, password);

      if (result.type === 'success' && result.user && result.tokens) {
        const user = this.mapAuth0UserToUser(result.user);
        const tokens: AuthTokens = {
          accessToken: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token,
          expiresAt: Date.now() + result.tokens.expires_in * 1000,
        };
        await this.finalizeSuccessfulLogin(user, tokens);
        return true;
      }

      runInAction(() => {
        this.error = result.type === 'error' ? result.error : "Authentication error";
        this.isLoading = false;
      });
      return false;
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : 'Connection error';
        this.isLoading = false;
      });
      return false;
    }
  }

  async requestPasswordlessSms(e164: string): Promise<boolean> {
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      const result = await startLoginOtpSms(e164);
      if (result.ok) {
        runInAction(() => {
          this.isLoading = false;
        });
        return true;
      }
      runInAction(() => {
        this.error = result.error;
        this.isLoading = false;
      });
      return false;
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : 'Connection error';
        this.isLoading = false;
      });
      return false;
    }
  }

  async requestPasswordlessEmailOtp(email: string): Promise<boolean> {
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      const result = await startLoginOtpEmail(email);
      if (result.ok) {
        runInAction(() => {
          this.isLoading = false;
        });
        return true;
      }
      runInAction(() => {
        this.error = result.error;
        this.isLoading = false;
      });
      return false;
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : 'Connection error';
        this.isLoading = false;
      });
      return false;
    }
  }

  async loginWithPasswordlessOtp(e164: string, otp: string): Promise<boolean> {
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      const result = await verifyLoginOtpSms(e164, otp);

      if (result.type === 'success' && result.user && result.tokens) {
        const user = this.mapAuth0UserToUser(result.user);
        const tokens: AuthTokens = {
          accessToken: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token,
          expiresAt: Date.now() + result.tokens.expires_in * 1000,
        };
        await this.finalizeSuccessfulLogin(user, tokens);
        return true;
      }

      runInAction(() => {
        this.error = result.type === 'error' ? result.error : "Authentication error";
        this.isLoading = false;
      });
      return false;
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : 'Connection error';
        this.isLoading = false;
      });
      return false;
    }
  }

  async loginWithPasswordlessEmailOtp(email: string, otp: string): Promise<boolean> {
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      const result = await verifyLoginOtpEmail(email, otp);

      if (result.type === 'success' && result.user && result.tokens) {
        const user = this.mapAuth0UserToUser(result.user);
        const tokens: AuthTokens = {
          accessToken: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token,
          expiresAt: Date.now() + result.tokens.expires_in * 1000,
        };
        await this.finalizeSuccessfulLogin(user, tokens);
        return true;
      }

      runInAction(() => {
        this.error = result.type === 'error' ? result.error : "Authentication error";
        this.isLoading = false;
      });
      return false;
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : 'Connection error';
        this.isLoading = false;
      });
      return false;
    }
  }

  async completeSignupWithOtp(
    attemptId: string,
    otp: string
  ): Promise<{ ok: boolean; launchPromo: SignupLaunchPromo | null }> {
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      const result = await verifySignupOtp(attemptId, otp);
      if (result.type === 'success' && result.user && result.tokens) {
        const user = this.mapAuth0UserToUser(result.user);
        const tokens: AuthTokens = {
          accessToken: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token,
          expiresAt: Date.now() + result.tokens.expires_in * 1000,
        };
        if (result.launchPromo) {
          this.setSignupLaunchPromo(result.launchPromo);
        }
        await this.finalizeSuccessfulLogin(user, tokens);
        return { ok: true, launchPromo: result.launchPromo };
      }

      runInAction(() => {
        this.error =
          result.type === 'error' ? result.error : "Authentication error";
        this.isLoading = false;
      });
      return { ok: false, launchPromo: null };
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : 'Connection error';
        this.isLoading = false;
      });
      return { ok: false, launchPromo: null };
    }
  }

  async signupWithCredentials(signupData: SignupData): Promise<boolean> {
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      const result = await Auth0DirectService.signupWithCredentials(signupData);

      if (result.type === 'success' && result.user) {
        runInAction(() => {
          this.isLoading = false;
          this.error = null;
        });
        return true;
      }

      runInAction(() => {
        this.error = result.type === 'error' ? result.error : "Erreur d'inscription";
        this.isLoading = false;
      });
      return false;
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : "Erreur d'inscription";
        this.isLoading = false;
      });
      return false;
    }
  }

  async logout(mode: 'keep' | 'remove' = 'remove'): Promise<void> {
    runInAction(() => {
      this.isLoading = true;
    });
    try {
      await SessionService.logout(mode);
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  /** Photo à afficher : locale si définie, sinon picture Auth0. */
  get displayProfilePhotoUri(): string | null {
    return this.localProfilePhotoUri ?? this.user?.picture ?? null;
  }

  async setLocalProfilePhoto(uri: string | null): Promise<void> {
    runInAction(() => {
      this.localProfilePhotoUri = uri;
    });
    if (uri !== null) {
      await AsyncStorage.setItem(STORAGE_KEYS.profilePhotoUri, uri);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.profilePhotoUri);
    }
  }

  get isTokenValid(): boolean {
    if (!this.tokens) return false;
    const buffer = 5 * 60 * 1000;
    return Date.now() < this.tokens.expiresAt - buffer;
  }

  async refreshToken(): Promise<boolean> {
    const result = await Auth0DirectService.refreshAccessTokenDetailed();
    if (!result.ok) {
      // A dead/revoked refresh token (`invalid_grant`) or no refresh token
      // at all (`no_refresh_token`) means the session can never recover on
      // its own — only a network error is worth staying "logged in" for,
      // since a later retry might succeed once connectivity is back.
      // Keep the saved-account row and prompt for a fresh sign-in.
      if (result.reason === 'invalid_grant' || result.reason === 'no_refresh_token') {
        await SessionService.clearDeadRefreshTokenForActiveAccount();
        await this.logout('keep');
        runInAction(() => {
          this.error = 'savedAccounts.errors.signInRequired';
        });
      }
      return false;
    }

    const tokens: AuthTokens = {
      accessToken: result.tokens.access_token,
      // Auth0DirectService.saveTokens already preserves the previous refresh
      // token when the response omits one; mirror the same fallback here so
      // the in-memory store doesn't lose it either.
      refreshToken: result.tokens.refresh_token ?? this.tokens?.refreshToken,
      expiresAt: Date.now() + result.tokens.expires_in * 1000,
    };
    runInAction(() => {
      this.tokens = tokens;
    });
    await this.persistAuth();
    return true;
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.isAuthenticated || !this.tokens) return null;
    if (!this.isTokenValid) {
      const ok = await this.refreshToken();
      if (!ok) return this.tokens?.accessToken ?? null;
    }
    return this.tokens?.accessToken ?? null;
  }

  private async persistAuth(): Promise<void> {
    if (!this.user || !this.tokens) return;
    const { accessToken, expiresAt } = this.tokens;
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(this.user)),
      AsyncStorage.setItem(
        STORAGE_KEYS.tokens,
        JSON.stringify({ accessToken, expiresAt })
      ),
      AsyncStorage.setItem(STORAGE_KEYS.isAuthenticated, 'true'),
    ]);
  }

  private async clearPersistedAuth(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.user),
      AsyncStorage.removeItem(STORAGE_KEYS.tokens),
      AsyncStorage.removeItem(STORAGE_KEYS.isAuthenticated),
      AsyncStorage.removeItem(STORAGE_KEYS.profilePhotoUri),
      AsyncStorage.removeItem(STORAGE_KEYS.postAuthResumeInventoryItemId),
      AsyncStorage.removeItem(STORAGE_KEYS.postAuthResumeInventoryDetailId),
      AsyncStorage.removeItem(STORAGE_KEYS.postAuthResumeCartCheckout),
      AsyncStorage.removeItem(STORAGE_KEYS.postAuthResumeLikeItemId),
    ]);
  }

  async hydrate(): Promise<void> {
    await this.loadPostAuthResumeFromStorage();
    await Auth0DirectService.hydrateActiveRefreshTokenKey();
    // Cleanup: remove old pendingSignupUserId key from pre-attempt rename (one-time migration).
    void AsyncStorage.removeItem('@RendasuaAgent:pendingSignupUserId').catch(() => {
      /* ignore */
    });
    try {
      const pendingWelcome = await StorageService.getObject<{
        pending?: boolean;
        persona?: AuthStore['signupWelcomePersona'];
        launchPromo?: AuthStore['signupLaunchPromo'];
      }>(APP_STORAGE_KEYS.pendingSignupWelcome);
      if (pendingWelcome) {
        runInAction(() => {
          this.signupWelcomePending = Boolean(pendingWelcome.pending);
          this.signupWelcomePersona = pendingWelcome.persona ?? null;
          this.signupLaunchPromo = pendingWelcome.launchPromo ?? null;
        });
      }

      const [userData, tokensData, isAuth, activeAccountId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.user),
        AsyncStorage.getItem(STORAGE_KEYS.tokens),
        AsyncStorage.getItem(STORAGE_KEYS.isAuthenticated),
        SavedAccountService.getActiveSavedAccountId(),
      ]);

      if (activeAccountId) {
        runInAction(() => {
          this.activeSavedAccountId = activeAccountId;
        });
      }

      if (!userData || !tokensData || isAuth !== 'true') {
        runInAction(() => {
          this.isAuthenticated = false;
          this.user = null;
          this.tokens = null;
          this.localProfilePhotoUri = null;
        });
        return;
      }

      const profilePhotoUri = await AsyncStorage.getItem(STORAGE_KEYS.profilePhotoUri);

      const user = JSON.parse(userData) as User;
      const parsedTokens = JSON.parse(tokensData) as AuthTokens;
      const tokens: AuthTokens = {
        accessToken: parsedTokens.accessToken,
        refreshToken: parsedTokens.refreshToken,
        expiresAt: parsedTokens.expiresAt,
      };

      if (!user?.id || !tokens?.expiresAt) {
        await this.clearPersistedAuth();
        runInAction(() => {
          this.isAuthenticated = false;
          this.user = null;
          this.tokens = null;
          this.localProfilePhotoUri = null;
        });
        return;
      }

      if (Date.now() < tokens.expiresAt) {
        runInAction(() => {
          this.user = user;
          this.tokens = tokens;
          this.isAuthenticated = true;
          this.localProfilePhotoUri = profilePhotoUri;
        });
        await SessionService.migrateExistingSessionOnHydrate();
        this.schedulePushTokenRegistration();
        this.flushPendingLike();
        return;
      }

      // Token is expired: refresh it first before advertising isAuthenticated=true
      // so that ensureSession() never fires with a stale/expired token.
      const result = await Auth0DirectService.refreshAccessTokenDetailed();
      if (result.ok) {
        runInAction(() => {
          this.user = user;
          this.tokens = {
            accessToken: result.tokens.access_token,
            expiresAt: Date.now() + result.tokens.expires_in * 1000,
          };
          this.isAuthenticated = true;
          this.localProfilePhotoUri = profilePhotoUri;
        });
        await this.persistAuth();
        await SessionService.migrateExistingSessionOnHydrate();
      } else if (result.reason === 'invalid_grant' || result.reason === 'no_refresh_token') {
        await SessionService.clearDeadRefreshTokenForActiveAccount();
        await this.logout('keep');
        runInAction(() => {
          this.error = 'savedAccounts.errors.signInRequired';
        });
        return;
      } else {
        // Refresh failed for a transient reason; still let the app proceed with
        // the stale token so the user isn't hard-blocked (ensureSession will
        // retry the API call which may succeed if the server clock skew is small).
        runInAction(() => {
          this.user = user;
          this.tokens = tokens;
          this.isAuthenticated = true;
          this.localProfilePhotoUri = profilePhotoUri;
        });
        await SessionService.migrateExistingSessionOnHydrate();
      }
      this.schedulePushTokenRegistration();
      this.flushPendingLike();
    } catch {
      await this.clearPersistedAuth();
      runInAction(() => {
        this.isAuthenticated = false;
        this.user = null;
        this.tokens = null;
        this.localProfilePhotoUri = null;
      });
    }
  }

  reset(): void {
    this.isAuthenticated = false;
    this.isLoading = false;
    this.user = null;
    this.tokens = null;
    this.localProfilePhotoUri = null;
    this.error = null;
    this.postAuthResumeInventoryItemId = null;
    this.postAuthResumeInventoryDetailId = null;
    this.postAuthResumeCartCheckout = false;
    this.postAuthResumeLikeItemId = null;
    this.signupWelcomePending = false;
    this.signupWelcomePersona = null;
    this.signupLaunchPromo = null;
    void StorageService.remove(APP_STORAGE_KEYS.pendingSignupWelcome);
    this.activeSavedAccountId = null;
    this.biometricPromptPending = false;
  }
}
