import { reelAiTokenCost, REEL_AI_VEO_TIERS } from './reelAiTokenCost';

describe('reelAiTokenCost', () => {
  it('prices fast and standard only', () => {
    expect(REEL_AI_VEO_TIERS).toEqual(['fast', 'standard']);
    expect(reelAiTokenCost('fast')).toBe(1);
    expect(reelAiTokenCost('standard')).toBe(4);
  });
});
