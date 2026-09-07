import { describe, expect, it } from 'vitest';
import type { CleanupKindsByIndex } from './imageCleanupKinds';
import {
  aiTokensRemainingAfterSelections,
  canSelectAiCleanup,
  countAiCleanupSelections,
  toggleCleanupKindAt,
} from './imageCleanupKinds';

describe('imageCleanupKinds', () => {
  const base: CleanupKindsByIndex = { 0: 'rembg', 1: null, 2: 'ai' };

  it('counts only AI selections for tokens', () => {
    expect(countAiCleanupSelections(base)).toBe(1);
    expect(aiTokensRemainingAfterSelections(3, base)).toBe(2);
  });

  it('toggles mutually exclusive kinds and clears on second tap', () => {
    let kinds: CleanupKindsByIndex = {};
    kinds = toggleCleanupKindAt(kinds, 0, 'rembg', 2);
    expect(kinds[0]).toBe('rembg');
    kinds = toggleCleanupKindAt(kinds, 0, 'ai', 2);
    expect(kinds[0]).toBe('ai');
    kinds = toggleCleanupKindAt(kinds, 0, 'ai', 2);
    expect(kinds[0]).toBeNull();
  });

  it('blocks new AI when tokens are exhausted by other photos', () => {
    const kinds: CleanupKindsByIndex = { 0: 'ai', 1: null };
    expect(canSelectAiCleanup(1, kinds, 1)).toBe(false);
    expect(toggleCleanupKindAt(kinds, 1, 'ai', 1)[1]).toBeNull();
    expect(canSelectAiCleanup(1, kinds, 0)).toBe(true);
  });
});
