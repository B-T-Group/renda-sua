import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type SecureStoreSetOptions = {
  requireAuthentication?: boolean;
};

/**
 * Hardware-backed storage for refresh tokens only.
 * On web, storage is unavailable — callers must fall back to OTP login.
 */
export class SecureStorageService {
  isAvailable(): boolean {
    return Platform.OS !== 'web';
  }

  async getRefreshToken(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  }

  async setRefreshToken(
    key: string,
    token: string,
    options?: SecureStoreSetOptions
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await SecureStore.setItemAsync(key, token, {
        requireAuthentication: options?.requireAuthentication ?? false,
      });
      return true;
    } catch {
      return false;
    }
  }

  async deleteRefreshToken(key: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* ignore */
    }
  }
}

export default new SecureStorageService();
