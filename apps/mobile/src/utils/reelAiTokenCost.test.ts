import { describe, expect, it } from 'vitest';
import { reelAiTokenCost, tiersForAudio } from './reelAiTokenCost';

describe('reelAiTokenCost', () => {
  it('matches backend pricing matrix', () => {
    expect(reelAiTokenCost({ tier: 'lite', generateAudio: true })).toBe(1);
    expect(reelAiTokenCost({ tier: 'fast', generateAudio: true })).toBe(2);
    expect(reelAiTokenCost({ tier: 'standard', generateAudio: true })).toBe(8);
    expect(reelAiTokenCost({ tier: 'fast', generateAudio: false })).toBe(1);
    expect(reelAiTokenCost({ tier: 'standard', generateAudio: false })).toBe(4);
  });

  it('hides lite without audio for merchants', () => {
    expect(tiersForAudio(false, false)).toEqual(['fast', 'standard']);
    expect(tiersForAudio(true, false)).toEqual(['lite', 'fast', 'standard']);
    expect(tiersForAudio(false, true)).toEqual(['lite', 'fast', 'standard']);
  });
});
