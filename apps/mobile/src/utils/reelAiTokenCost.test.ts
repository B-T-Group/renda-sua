import { describe, expect, it } from 'vitest';
import { reelAiTokenCost } from './reelAiTokenCost';

describe('reelAiTokenCost', () => {
  it('prices by tier with native audio', () => {
    expect(reelAiTokenCost('lite')).toBe(1);
    expect(reelAiTokenCost('fast')).toBe(2);
    expect(reelAiTokenCost('standard')).toBe(8);
  });
});
