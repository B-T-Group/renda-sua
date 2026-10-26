import {
  freeTokensToRestore,
  holdAfterConsume,
  holdAfterRefund,
  type CleanupTokenHold,
} from './cleanup-token-hold';

function hold(over: Partial<CleanupTokenHold> = {}): CleanupTokenHold {
  return {
    tokens_reserved: 5,
    tokens_consumed: 0,
    tokens_refunded: 0,
    nongiftable_reserved: 2,
    ...over,
  };
}

describe('cleanup token hold', () => {
  it('refunds purchased tokens before the free allotment', () => {
    let current = hold();
    const restored: number[] = [];
    for (let i = 0; i < 5; i++) {
      const free = freeTokensToRestore(current, 1);
      restored.push(free);
      current = holdAfterRefund(current, 1, free);
    }
    expect(restored).toEqual([0, 0, 0, 1, 1]);
    expect(current.nongiftable_reserved).toBe(0);
    expect(current.tokens_refunded).toBe(5);
  });

  it('keeps a successful photo on the free allotment', () => {
    let current = holdAfterConsume(hold(), 1);
    expect(current.nongiftable_reserved).toBe(1);
    expect(freeTokensToRestore(current, 1)).toBe(0);
    current = holdAfterRefund(current, 1, 0);
    current = holdAfterRefund(current, 1, 0);
    current = holdAfterRefund(current, 1, 0);
    expect(freeTokensToRestore(current, 1)).toBe(1);
  });

  it('restores nothing when the hold has no free tokens', () => {
    expect(freeTokensToRestore(hold({ nongiftable_reserved: 0 }), 3)).toBe(0);
  });
});
