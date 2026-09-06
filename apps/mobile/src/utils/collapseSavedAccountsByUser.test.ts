import { describe, expect, it } from 'vitest';
import type { SavedAccount } from '../types/savedAccount';
import {
  collapseSavedAccountsByUser,
  pickSavedAccountWinner,
} from './collapseSavedAccountsByUser';

function account(
  overrides: Partial<SavedAccount> & Pick<SavedAccount, 'id' | 'userId' | 'persona'>
): SavedAccount {
  return {
    environment: 'prod',
    displayName: 'Ada',
    email: 'ada@x.com',
    lastUsedAt: 1,
    biometricEnabled: false,
    secureStoreKey: `key-${overrides.id}`,
    createdAt: 1,
    ...overrides,
  };
}

describe('collapseSavedAccountsByUser', () => {
  it('keeps one row per env and user', () => {
    const client = account({
      id: 'c',
      userId: 'u1',
      persona: 'client',
      lastUsedAt: 10,
    });
    const agent = account({
      id: 'a',
      userId: 'u1',
      persona: 'agent',
      lastUsedAt: 20,
    });
    const other = account({
      id: 'o',
      userId: 'u2',
      persona: 'client',
      lastUsedAt: 5,
    });
    const { kept, removed } = collapseSavedAccountsByUser([client, agent, other]);
    expect(kept.map((row) => row.id).sort()).toEqual(['a', 'o']);
    expect(removed.map((row) => row.id)).toEqual(['c']);
  });

  it('prefers a biometric-enabled row over a newer one without biometrics', () => {
    const newer = account({
      id: 'new',
      userId: 'u1',
      persona: 'client',
      lastUsedAt: 50,
      biometricEnabled: false,
    });
    const bio = account({
      id: 'bio',
      userId: 'u1',
      persona: 'agent',
      lastUsedAt: 1,
      biometricEnabled: true,
    });
    expect(pickSavedAccountWinner(newer, bio).id).toBe('bio');
  });
});
