import { describe, expect, it } from 'vitest';
import {
  buildLegacyRefreshTokenSecureStoreKeySync,
  buildRefreshTokenSecureStoreKeySync,
  isV1RefreshTokenKey,
  isV2RefreshTokenKey,
} from './secureStoreKey';

describe('buildRefreshTokenSecureStoreKeySync', () => {
  it('includes env segment and stable hash prefix (v2)', () => {
    const key = buildRefreshTokenSecureStoreKeySync('prod', 'auth0|user-123', 'client');
    expect(key).toMatch(/^com\.rendasua\.agent\.refresh\.v2\.prod\.[a-f0-9]{16}$/);
    expect(isV2RefreshTokenKey(key)).toBe(true);
  });

  it('isolates environments', () => {
    const prod = buildRefreshTokenSecureStoreKeySync('prod', 'auth0|same-user', 'client');
    const dev = buildRefreshTokenSecureStoreKeySync('dev', 'auth0|same-user', 'client');
    expect(prod).not.toEqual(dev);
  });

  it('isolates users within same env', () => {
    const a = buildRefreshTokenSecureStoreKeySync('dev', 'auth0|user-a', 'client');
    const b = buildRefreshTokenSecureStoreKeySync('dev', 'auth0|user-b', 'client');
    expect(a).not.toEqual(b);
  });

  it('isolates personas for the same user', () => {
    const client = buildRefreshTokenSecureStoreKeySync('prod', 'auth0|same-user', 'client');
    const agent = buildRefreshTokenSecureStoreKeySync('prod', 'auth0|same-user', 'agent');
    expect(client).not.toEqual(agent);
  });
});

describe('buildLegacyRefreshTokenSecureStoreKeySync', () => {
  it('uses v1 prefix without persona', () => {
    const key = buildLegacyRefreshTokenSecureStoreKeySync('prod', 'auth0|user-123');
    expect(key).toMatch(/^com\.rendasua\.agent\.refresh\.v1\.prod\.[a-f0-9]{16}$/);
    expect(isV1RefreshTokenKey(key)).toBe(true);
    expect(isV2RefreshTokenKey(key)).toBe(false);
  });
});
