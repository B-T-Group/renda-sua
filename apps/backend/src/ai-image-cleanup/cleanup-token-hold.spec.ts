import {
  freeTokensToRestore,
  holdAfterConsume,
  holdAfterRefund,
  tokenHoldFromJob,
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

  it('does not restore free tokens for a zero or negative refund', () => {
    expect(freeTokensToRestore(hold(), 0)).toBe(0);
    expect(freeTokensToRestore(hold(), -1)).toBe(0);
  });

  it('never restores more free tokens than the hold recorded', () => {
    expect(freeTokensToRestore(hold(), 8)).toBe(2);
    expect(
      freeTokensToRestore(hold({ nongiftable_reserved: -3 }), 5)
    ).toBe(0);
  });

  it('refunds the remainder as purchased tokens after the free hold is spent', () => {
    const spent = holdAfterConsume(
      hold({ tokens_reserved: 4, nongiftable_reserved: 2 }),
      2
    );
    expect(spent.nongiftable_reserved).toBe(0);
    expect(spent.tokens_consumed).toBe(2);
    expect(freeTokensToRestore(spent, 2)).toBe(0);
  });

  it('reads a job from before the free-hold column as zeros', () => {
    expect(
      tokenHoldFromJob({
        tokens_reserved: null,
        tokens_consumed: null,
        tokens_refunded: null,
        nongiftable_reserved: null,
      })
    ).toEqual({
      tokens_reserved: 0,
      tokens_consumed: 0,
      tokens_refunded: 0,
      nongiftable_reserved: 0,
    });
    const restored = holdAfterRefund(hold({ nongiftable_reserved: 1 }), 1, 5);
    expect(restored.nongiftable_reserved).toBe(0);
    expect(restored.tokens_refunded).toBe(1);
  });
});
