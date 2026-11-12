import { afterEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearActivePersonaStorage, writeStoredContext } from '../utils/activePersonaStorage';
import auth0Direct from './auth0DirectService';

describe('loginWithCredentials token request', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearActivePersonaStorage();
    await AsyncStorage.clear();
  });

  it('posts active_persona on the password grant when a persona is stored', async () => {
    await writeStoredContext({
      userId: 'user-1',
      kind: 'persona',
      persona: 'business',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'invalid_grant' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await auth0Direct.loginWithCredentials(
      'oru@rendasua-test.com',
      'secret'
    );

    expect(result.type).toBe('error');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain('"grant_type":"password"');
    expect(JSON.parse(String(init.body))).toMatchObject({
      grant_type: 'password',
      username: 'oru@rendasua-test.com',
      active_persona: 'business',
    });
  });
});
