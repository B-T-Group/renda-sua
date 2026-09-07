/**
 * Service Auth0 Direct pour Rendasua Agent (mobile).
 * Access tokens in AsyncStorage; refresh tokens in SecureStore only.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEnv, getTokenRequestAudience } from '../config/auth0';
import { readHasuraUserId, readStoredPersona, clearActivePersonaStorage } from '../utils/activePersonaStorage';
import SecureStorageService from './storage/SecureStorageService';
import StorageService from './storage/StorageService';
import { ACTIVE_REFRESH_TOKEN_KEY_KEY } from './savedAccount/SavedAccountService';

const STORAGE_PREFIX = '@RendasuaAgent:';
const STORAGE_KEYS = {
  accessToken: `${STORAGE_PREFIX}accessToken`,
  refreshToken: `${STORAGE_PREFIX}refreshToken`,
  user: `${STORAGE_PREFIX}user`,
  expiresAt: `${STORAGE_PREFIX}expiresAt`,
};
const TOKENS_JSON_KEY = `${STORAGE_PREFIX}tokens`;

const AUTH0_CONNECTION = 'Username-Password-Authentication';

const AUTH0_SCOPES =
  'openid profile email offline_access read:current_user update:current_user_metadata';

export interface Auth0User {
  sub: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  phone_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface Auth0Tokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export type Auth0Response =
  | { type: 'success'; user: Auth0User; tokens?: Auth0Tokens }
  | { type: 'error'; error: string };

export type RefreshResult =
  | { ok: true; tokens: Auth0Tokens }
  | { ok: false; reason: 'no_refresh_token' | 'invalid_grant' | 'network' };

export interface SignupData {
  email: string;
  password: string;
  name: string;
  firstName?: string;
  lastName?: string;
}

export class Auth0DirectService {
  private static instance: Auth0DirectService;
  private activeRefreshTokenKey: string | null = null;
  private pendingRefresh: Promise<RefreshResult> | null = null;
  /** Persona key for the in-flight refresh; avoids coalescing mismatched switches. */
  private pendingRefreshPersonaKey: string | null = null;

  private constructor() {}

  static getInstance(): Auth0DirectService {
    if (!Auth0DirectService.instance) {
      Auth0DirectService.instance = new Auth0DirectService();
    }
    return Auth0DirectService.instance;
  }

  async setActiveRefreshTokenKey(key: string | null): Promise<void> {
    this.activeRefreshTokenKey = key;
    if (key) {
      await StorageService.setString(ACTIVE_REFRESH_TOKEN_KEY_KEY, key);
    } else {
      await StorageService.remove(ACTIVE_REFRESH_TOKEN_KEY_KEY);
    }
  }

  async hydrateActiveRefreshTokenKey(): Promise<void> {
    const key = await StorageService.getString(ACTIVE_REFRESH_TOKEN_KEY_KEY);
    this.activeRefreshTokenKey = key?.trim() || null;
  }

  async sendPasswordResetEmail(email: string): Promise<{ ok: boolean; message: string }> {
    try {
      const { auth0Config } = getEnv();
      const response = await fetch(`https://${auth0Config.domain}/dbconnections/change_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: auth0Config.clientId,
          email,
          connection: AUTH0_CONNECTION,
        }),
      });
      const text = await response.text();
      return { ok: response.ok, message: text || (response.ok ? 'OK' : 'ERROR') };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'UNKNOWN_ERROR' };
    }
  }

  async loginWithCredentials(email: string, password: string): Promise<Auth0Response> {
    try {
      const { auth0Config } = getEnv();
      const audience = getTokenRequestAudience(auth0Config);
      const response = await fetch(`https://${auth0Config.domain}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'password',
          username: email,
          password,
          client_id: auth0Config.clientId,
          audience,
          scope: AUTH0_SCOPES,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return {
          type: 'error',
          error: err.error_description || err.error || 'Identifiants incorrects',
        };
      }

      const tokens: Auth0Tokens = await response.json();
      const userInfo = await this.getUserInfo(tokens.access_token);
      await this.saveTokens(tokens);
      await this.saveUser(userInfo);

      return { type: 'success', user: userInfo, tokens };
    } catch (e) {
      return {
        type: 'error',
        error: e instanceof Error ? e.message : 'Erreur de connexion',
      };
    }
  }

  async finalizeAuthWithTokens(tokens: Auth0Tokens): Promise<Auth0Response> {
    try {
      const userInfo = await this.getUserInfo(tokens.access_token);
      await this.saveTokens(tokens);
      await this.saveUser(userInfo);
      return { type: 'success', user: userInfo, tokens };
    } catch (e) {
      return {
        type: 'error',
        error: e instanceof Error ? e.message : 'Erreur de connexion',
      };
    }
  }

  async signupWithCredentials(data: SignupData): Promise<Auth0Response> {
    try {
      const { auth0Config } = getEnv();
      const response = await fetch(`https://${auth0Config.domain}/dbconnections/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: auth0Config.clientId,
          email: data.email,
          password: data.password,
          name: data.name,
          given_name: data.firstName,
          family_name: data.lastName,
          connection: AUTH0_CONNECTION,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let msg = 'Erreur lors de la création du compte';
        try {
          const o = JSON.parse(text);
          msg = o.message || o.error_description || msg;
        } catch {}
        if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate')) {
          msg = 'Cet email est déjà utilisé';
        }
        return { type: 'error', error: msg };
      }

      const created = await response.json();
      return {
        type: 'success',
        user: {
          sub: created._id || '',
          email: created.email || data.email,
          email_verified: false,
          name: data.name,
          given_name: data.firstName,
          family_name: data.lastName,
        },
      };
    } catch (e) {
      return {
        type: 'error',
        error: e instanceof Error ? e.message : "Erreur d'inscription",
      };
    }
  }

  async getUserInfo(accessToken: string): Promise<Auth0User> {
    const { auth0Config } = getEnv();
    const response = await fetch(`https://${auth0Config.domain}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('Impossible de récupérer les informations utilisateur');
    return response.json();
  }

  async refreshAccessToken(params?: { active_persona?: string }): Promise<Auth0Tokens | null> {
    const result = await this.refreshAccessTokenDetailed(params);
    return result.ok ? result.tokens : null;
  }

  private async resolveRefreshPersona(
    params?: { active_persona?: string }
  ): Promise<string | undefined> {
    if (params?.active_persona) return params.active_persona;
    const [stored, hid] = await Promise.all([readStoredPersona(), readHasuraUserId()]);
    if (stored && hid && stored.userId === hid) return stored.persona;
    return undefined;
  }

  async refreshAccessTokenDetailed(params?: { active_persona?: string }): Promise<RefreshResult> {
    const activePersona = await this.resolveRefreshPersona(params);
    const personaKey = activePersona ?? '';

    if (this.pendingRefresh && this.pendingRefreshPersonaKey === personaKey) {
      return this.pendingRefresh;
    }
    if (this.pendingRefresh) {
      await this.pendingRefresh.catch(() => undefined);
    }

    const run = async (): Promise<RefreshResult> => {
      try {
        const refreshToken = await this.getStoredRefreshToken();
        if (!refreshToken) return { ok: false, reason: 'no_refresh_token' };

        const { auth0Config } = getEnv();
        const body: Record<string, string> = {
          grant_type: 'refresh_token',
          client_id: auth0Config.clientId,
          refresh_token: refreshToken,
        };
        if (activePersona) {
          body.active_persona = activePersona;
        }
        const response = await fetch(`https://${auth0Config.domain}/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const reason = err?.error === 'invalid_grant' ? 'invalid_grant' : 'network';
          return { ok: false, reason };
        }
        const tokens: Auth0Tokens = await response.json();
        await this.saveTokens(tokens);
        return { ok: true, tokens };
      } catch {
        return { ok: false, reason: 'network' };
      }
    };

    this.pendingRefreshPersonaKey = personaKey;
    this.pendingRefresh = run().finally(() => {
      this.pendingRefresh = null;
      this.pendingRefreshPersonaKey = null;
    });
    return this.pendingRefresh;
  }

  async logout(options?: { preserveRefreshToken?: boolean }): Promise<void> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);
      if (token) {
        const { auth0Config } = getEnv();
        await fetch(`https://${auth0Config.domain}/oauth/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: auth0Config.clientId, token }),
        });
      }
    } catch {}
    await this.clearSessionTokens();
    if (!options?.preserveRefreshToken) {
      if (this.activeRefreshTokenKey) {
        await SecureStorageService.deleteRefreshToken(this.activeRefreshTokenKey);
      }
      this.activeRefreshTokenKey = null;
      await StorageService.remove(ACTIVE_REFRESH_TOKEN_KEY_KEY);
    }
    await clearActivePersonaStorage();
    await AsyncStorage.removeItem(`${STORAGE_PREFIX}isAuthenticated`);
  }

  /** Clears access/session AsyncStorage without touching SecureStore refresh tokens. */
  async clearSessionTokens(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.accessToken),
      AsyncStorage.removeItem(STORAGE_KEYS.refreshToken),
      AsyncStorage.removeItem(STORAGE_KEYS.user),
      AsyncStorage.removeItem(STORAGE_KEYS.expiresAt),
      AsyncStorage.removeItem(TOKENS_JSON_KEY),
    ]);
  }

  async getAccessToken(): Promise<string | null> {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);
    const expiresAt = await AsyncStorage.getItem(STORAGE_KEYS.expiresAt);
    if (!token || !expiresAt) return null;
    const exp = parseInt(expiresAt, 10);
    if (Date.now() >= exp) {
      const refreshed = await this.refreshAccessToken();
      return refreshed?.access_token ?? null;
    }
    return token;
  }

  isTokenValid(): boolean {
    return true;
  }

  async getUser(): Promise<Auth0User | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  }

  async syncSessionUserAndAccessToken(params: {
    accessToken: string;
    expiresAt: number;
    user: Auth0User;
  }): Promise<void> {
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.accessToken, params.accessToken),
      AsyncStorage.setItem(STORAGE_KEYS.expiresAt, String(params.expiresAt)),
      AsyncStorage.setItem(
        TOKENS_JSON_KEY,
        JSON.stringify({ accessToken: params.accessToken, expiresAt: params.expiresAt })
      ),
      this.saveUser(params.user),
    ]);
  }

  async saveTokens(tokens: Auth0Tokens): Promise<void> {
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    const existingRefreshToken = await this.getStoredRefreshToken();
    const refreshToken = tokens.refresh_token ?? existingRefreshToken ?? null;

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.accessToken, tokens.access_token),
      AsyncStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt)),
    ]);

    if (refreshToken && this.activeRefreshTokenKey) {
      await SecureStorageService.setRefreshToken(this.activeRefreshTokenKey, refreshToken);
    }

    await AsyncStorage.removeItem(STORAGE_KEYS.refreshToken);
    await AsyncStorage.setItem(
      TOKENS_JSON_KEY,
      JSON.stringify({
        accessToken: tokens.access_token,
        expiresAt,
      })
    );
  }

  async getLegacyRefreshTokenFromAsyncStorage(): Promise<string | null> {
    const raw = await AsyncStorage.getItem(TOKENS_JSON_KEY);
    if (raw) {
      try {
        const o = JSON.parse(raw);
        if (o.refreshToken) return o.refreshToken as string;
      } catch {}
    }
    return AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
  }

  async migrateRefreshTokenOffAsyncStorage(refreshToken: string, secureStoreKey: string): Promise<void> {
    await SecureStorageService.setRefreshToken(secureStoreKey, refreshToken);
    this.activeRefreshTokenKey = secureStoreKey;
    await AsyncStorage.removeItem(STORAGE_KEYS.refreshToken);
    const raw = await AsyncStorage.getItem(TOKENS_JSON_KEY);
    if (raw) {
      try {
        const o = JSON.parse(raw);
        await AsyncStorage.setItem(
          TOKENS_JSON_KEY,
          JSON.stringify({
            accessToken: o.accessToken,
            expiresAt: o.expiresAt,
          })
        );
      } catch {}
    }
  }

  private async getStoredRefreshToken(): Promise<string | null> {
    if (!this.activeRefreshTokenKey) {
      await this.hydrateActiveRefreshTokenKey();
    }
    if (this.activeRefreshTokenKey) {
      const fromSecure = await SecureStorageService.getRefreshToken(this.activeRefreshTokenKey);
      if (fromSecure) return fromSecure;
    }
    return this.getLegacyRefreshTokenFromAsyncStorage();
  }

  private async saveUser(user: Auth0User): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  }
}

export default Auth0DirectService.getInstance();
