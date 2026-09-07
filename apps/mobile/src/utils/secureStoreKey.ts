import * as Crypto from 'expo-crypto';
import type { SavedAccountEnv, SavedAccountPersona } from '../types/savedAccount';

const KEY_PREFIX_V1 = 'com.rendasua.agent.refresh.v1';
const KEY_PREFIX_V2 = 'com.rendasua.agent.refresh.v2';

function syncHashSegment(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(16, '0').slice(0, 16);
}

/** Canonical SecureStore key: env + Auth0 user id (one token per user). */
export async function buildLegacyRefreshTokenSecureStoreKey(
  env: SavedAccountEnv,
  userId: string
): Promise<string> {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, userId);
  return `${KEY_PREFIX_V1}.${env}.${hash.slice(0, 16)}`;
}

/** Historical v2 key (env + user + persona). Kept to copy tokens during migration. */
export async function buildRefreshTokenSecureStoreKey(
  env: SavedAccountEnv,
  userId: string,
  persona: SavedAccountPersona
): Promise<string> {
  const material = `${userId}:${persona}`;
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, material);
  return `${KEY_PREFIX_V2}.${env}.${hash.slice(0, 16)}`;
}

/** Sync helper for unit tests (simple deterministic hash). */
export function buildRefreshTokenSecureStoreKeySync(
  env: SavedAccountEnv,
  userId: string,
  persona: SavedAccountPersona
): string {
  return `${KEY_PREFIX_V2}.${env}.${syncHashSegment(`${userId}:${persona}`)}`;
}

export function buildLegacyRefreshTokenSecureStoreKeySync(
  env: SavedAccountEnv,
  userId: string
): string {
  return `${KEY_PREFIX_V1}.${env}.${syncHashSegment(userId)}`;
}

export function isV1RefreshTokenKey(key: string): boolean {
  return key.startsWith(`${KEY_PREFIX_V1}.`);
}

export function isV2RefreshTokenKey(key: string): boolean {
  return key.startsWith(`${KEY_PREFIX_V2}.`);
}
