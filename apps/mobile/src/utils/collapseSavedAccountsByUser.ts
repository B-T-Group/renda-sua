import type { SavedAccount } from '../types/savedAccount';

export function savedAccountUserKey(
  account: Pick<SavedAccount, 'environment' | 'userId'>
): string {
  return `${account.environment}:${account.userId}`;
}

export function pickSavedAccountWinner(
  a: SavedAccount,
  b: SavedAccount
): SavedAccount {
  if (a.biometricEnabled !== b.biometricEnabled) {
    return a.biometricEnabled ? a : b;
  }
  return a.lastUsedAt >= b.lastUsedAt ? a : b;
}

export function collapseSavedAccountsByUser(accounts: SavedAccount[]): {
  kept: SavedAccount[];
  removed: SavedAccount[];
} {
  const groups = new Map<string, SavedAccount[]>();
  for (const account of accounts) {
    const key = savedAccountUserKey(account);
    const group = groups.get(key) ?? [];
    group.push(account);
    groups.set(key, group);
  }
  const kept: SavedAccount[] = [];
  const removed: SavedAccount[] = [];
  for (const group of groups.values()) {
    const winner = group.reduce(pickSavedAccountWinner);
    kept.push(winner);
    removed.push(...group.filter((row) => row.id !== winner.id));
  }
  return { kept, removed };
}
