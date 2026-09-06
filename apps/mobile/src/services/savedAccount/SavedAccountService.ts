import { getEffectiveEnv } from '../../config/envSwitch';
import type { Auth0User } from '../auth0DirectService';
import type { User } from '../../stores/AuthStore';
import type {
  SavedAccount,
  SavedAccountIndex,
  SavedAccountPersona,
} from '../../types/savedAccount';
import { collapseSavedAccountsByUser } from '../../utils/collapseSavedAccountsByUser';
import {
  buildLegacyRefreshTokenSecureStoreKey,
  isV2RefreshTokenKey,
} from '../../utils/secureStoreKey';
import SecureStorageService from '../storage/SecureStorageService';
import StorageService from '../storage/StorageService';

export const SAVED_ACCOUNTS_INDEX_KEY = '@RendasuaAgent:savedAccounts:v1';
export const ACTIVE_SAVED_ACCOUNT_ID_KEY = '@RendasuaAgent:activeSavedAccountId';
export const ACTIVE_REFRESH_TOKEN_KEY_KEY = '@RendasuaAgent:activeRefreshTokenKey';

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function displayNameFromUser(
  user: Pick<User, 'firstName' | 'lastName' | 'email' | 'phoneNumber'>
): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (user.email?.trim()) return user.email.trim();
  if (user.phoneNumber?.trim()) return user.phoneNumber.trim();
  return 'Account';
}

export class SavedAccountService {
  private async readIndexRaw(): Promise<SavedAccountIndex> {
    const index = await StorageService.getObject<SavedAccountIndex>(
      SAVED_ACCOUNTS_INDEX_KEY
    );
    if (index?.version === 1 && Array.isArray(index.accounts)) {
      return index;
    }
    return { version: 1, accounts: [] };
  }

  private async readIndex(): Promise<SavedAccountIndex> {
    return this.normalizeIndex(await this.readIndexRaw());
  }

  private async writeIndex(index: SavedAccountIndex): Promise<void> {
    await StorageService.setObject(SAVED_ACCOUNTS_INDEX_KEY, index);
  }

  private async normalizeIndex(index: SavedAccountIndex): Promise<SavedAccountIndex> {
    const { kept, removed } = collapseSavedAccountsByUser(index.accounts);
    const needsCollapse = removed.length > 0;
    const needsKeyMigrate = kept.some((a) => isV2RefreshTokenKey(a.secureStoreKey));
    if (!needsCollapse && !needsKeyMigrate) {
      return { version: 1, accounts: kept };
    }
    const migrated = await this.migrateKeptAccounts(kept, removed);
    const next = { version: 1 as const, accounts: migrated };
    await this.writeIndex(next);
    return next;
  }

  private async migrateKeptAccounts(
    kept: SavedAccount[],
    removed: SavedAccount[]
  ): Promise<SavedAccount[]> {
    const next: SavedAccount[] = [];
    for (const account of kept) {
      const extraKeys = removed
        .filter(
          (row) =>
            row.environment === account.environment && row.userId === account.userId
        )
        .map((row) => row.secureStoreKey);
      next.push(await this.migrateAccountToUserKey(account, extraKeys));
    }
    for (const row of removed) {
      await this.deleteKeyIfUnused(row.secureStoreKey);
    }
    return next;
  }

  async listForEnv(env = getEffectiveEnv()): Promise<SavedAccount[]> {
    const index = await this.readIndex();
    return index.accounts
      .filter((a) => a.environment === env)
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  }

  async findById(id: string): Promise<SavedAccount | null> {
    const index = await this.readIndex();
    return index.accounts.find((a) => a.id === id) ?? null;
  }

  async findByComposite(
    env: SavedAccount['environment'],
    userId: string
  ): Promise<SavedAccount | null> {
    const index = await this.readIndex();
    return (
      index.accounts.find((a) => a.environment === env && a.userId === userId) ??
      null
    );
  }

  async upsertFromSession(params: {
    user: User;
    persona?: SavedAccountPersona;
    biometricEnabled?: boolean;
    secureStoreKey: string;
  }): Promise<SavedAccount> {
    const env = getEffectiveEnv();
    const now = Date.now();
    const index = await this.readIndex();
    const existing = index.accounts.find(
      (a) => a.environment === env && a.userId === params.user.id
    );
    if (existing) {
      return this.updateExistingFromSession(index, existing, params, now);
    }
    return this.insertFromSession(index, params, env, now);
  }

  private async updateExistingFromSession(
    index: SavedAccountIndex,
    existing: SavedAccount,
    params: {
      user: User;
      persona?: SavedAccountPersona;
      biometricEnabled?: boolean;
      secureStoreKey: string;
    },
    now: number
  ): Promise<SavedAccount> {
    existing.displayName = displayNameFromUser(params.user);
    existing.email = params.user.email;
    existing.phone = params.user.phoneNumber;
    existing.avatar = params.user.picture;
    existing.lastUsedAt = now;
    existing.lastLoginAt = now;
    existing.secureStoreKey = params.secureStoreKey;
    if (params.persona) existing.persona = params.persona;
    if (params.biometricEnabled !== undefined) {
      existing.biometricEnabled = params.biometricEnabled;
    }
    await this.writeIndex(index);
    return existing;
  }

  private async insertFromSession(
    index: SavedAccountIndex,
    params: {
      user: User;
      persona?: SavedAccountPersona;
      biometricEnabled?: boolean;
      secureStoreKey: string;
    },
    env: SavedAccount['environment'],
    now: number
  ): Promise<SavedAccount> {
    const account: SavedAccount = {
      id: newId(),
      environment: env,
      userId: params.user.id,
      displayName: displayNameFromUser(params.user),
      email: params.user.email,
      phone: params.user.phoneNumber,
      avatar: params.user.picture,
      persona: params.persona,
      lastUsedAt: now,
      lastLoginAt: now,
      biometricEnabled: params.biometricEnabled ?? false,
      secureStoreKey: params.secureStoreKey,
      createdAt: now,
    };
    index.accounts.push(account);
    await this.writeIndex(index);
    return account;
  }

  async touchLastUsed(id: string): Promise<void> {
    const index = await this.readIndexRaw();
    const account = index.accounts.find((a) => a.id === id);
    if (!account) return;
    account.lastUsedAt = Date.now();
    await this.writeIndex(index);
  }

  async setBiometricEnabled(id: string, enabled: boolean): Promise<void> {
    const index = await this.readIndexRaw();
    const account = index.accounts.find((a) => a.id === id);
    if (!account) return;
    account.biometricEnabled = enabled;
    await this.writeIndex(index);
  }

  async setLabel(id: string, label: string | undefined): Promise<void> {
    const index = await this.readIndexRaw();
    const account = index.accounts.find((a) => a.id === id);
    if (!account) return;
    account.label = label?.trim() || undefined;
    await this.writeIndex(index);
  }

  async remove(id: string): Promise<SavedAccount | null> {
    const index = await this.readIndexRaw();
    const idx = index.accounts.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    const [removed] = index.accounts.splice(idx, 1);
    await this.writeIndex(index);
    return removed;
  }

  async getActiveSavedAccountId(): Promise<string | null> {
    return StorageService.getString(ACTIVE_SAVED_ACCOUNT_ID_KEY);
  }

  async setActiveSavedAccountId(id: string | null): Promise<void> {
    if (id) {
      await StorageService.setString(ACTIVE_SAVED_ACCOUNT_ID_KEY, id);
    } else {
      await StorageService.remove(ACTIVE_SAVED_ACCOUNT_ID_KEY);
    }
  }

  async getActiveRefreshTokenKey(): Promise<string | null> {
    return StorageService.getString(ACTIVE_REFRESH_TOKEN_KEY_KEY);
  }

  async setActiveRefreshTokenKey(key: string | null): Promise<void> {
    if (key) {
      await StorageService.setString(ACTIVE_REFRESH_TOKEN_KEY_KEY, key);
    } else {
      await StorageService.remove(ACTIVE_REFRESH_TOKEN_KEY_KEY);
    }
  }

  async buildSecureStoreKeyForAccount(userId: string): Promise<string> {
    return buildLegacyRefreshTokenSecureStoreKey(getEffectiveEnv(), userId);
  }

  async updateSecureStoreKey(id: string, secureStoreKey: string): Promise<void> {
    const index = await this.readIndexRaw();
    const account = index.accounts.find((a) => a.id === id);
    if (!account) return;
    account.secureStoreKey = secureStoreKey;
    await this.writeIndex(index);
  }

  async countAccountsUsingKey(key: string): Promise<number> {
    const index = await this.readIndexRaw();
    return index.accounts.filter((a) => a.secureStoreKey === key).length;
  }

  async migrateAccountSecureStoreKey(account: SavedAccount): Promise<SavedAccount> {
    return this.migrateAccountToUserKey(account, []);
  }

  private async migrateAccountToUserKey(
    account: SavedAccount,
    extraKeys: string[]
  ): Promise<SavedAccount> {
    const userKey = await buildLegacyRefreshTokenSecureStoreKey(
      account.environment,
      account.userId
    );
    await this.copyAnyTokenToKey(userKey, [account.secureStoreKey, ...extraKeys]);
    if (account.secureStoreKey === userKey) {
      return account;
    }
    const oldKey = account.secureStoreKey;
    await this.updateSecureStoreKey(account.id, userKey);
    await this.deleteKeyIfUnused(oldKey);
    return (await this.findByIdRaw(account.id)) ?? { ...account, secureStoreKey: userKey };
  }

  private async findByIdRaw(id: string): Promise<SavedAccount | null> {
    const index = await this.readIndexRaw();
    return index.accounts.find((a) => a.id === id) ?? null;
  }

  private async copyAnyTokenToKey(
    destKey: string,
    sourceKeys: string[]
  ): Promise<void> {
    if (await SecureStorageService.getRefreshToken(destKey)) return;
    for (const source of sourceKeys) {
      if (!source || source === destKey) continue;
      const token = await SecureStorageService.getRefreshToken(source);
      if (token) {
        await SecureStorageService.setRefreshToken(destKey, token);
        return;
      }
    }
  }

  private async deleteKeyIfUnused(key: string): Promise<void> {
    if ((await this.countAccountsUsingKey(key)) > 0) return;
    await SecureStorageService.deleteRefreshToken(key);
  }

  mapAuth0UserToSavedFields(
    user: Auth0User
  ): Pick<User, 'id' | 'email' | 'phoneNumber' | 'firstName' | 'lastName' | 'picture'> {
    return {
      id: user.sub,
      email: user.email?.trim() ?? '',
      phoneNumber: user.phone_number?.trim() || undefined,
      firstName: user.given_name,
      lastName: user.family_name,
      picture: user.picture,
    };
  }
}

export default new SavedAccountService();
