import {
  getReelAiTokenPack,
  reelAiTokenCost,
  resolvePurchasedReelAiPack,
  REEL_AI_TOKEN_PACKS,
} from './reel-ai-tokens.packs';

describe('reel-ai-tokens.packs', () => {
  it('prices each token at 1500 XAF / 3.75 CAD', () => {
    expect(REEL_AI_TOKEN_PACKS[0]).toEqual({
      id: 'reel_ai_pack_1',
      tokens: 1,
      prices: { CAD: 3.75, XAF: 1500 },
    });
    expect(getReelAiTokenPack('reel_ai_pack_5')?.prices.XAF).toBe(7500);
    expect(getReelAiTokenPack('reel_ai_pack_15')?.prices.CAD).toBe(56.25);
  });

  it('resolves packs only by paid amount, never by description', () => {
    expect(
      resolvePurchasedReelAiPack({ amount: 1500, currency: 'XAF' })?.id
    ).toBe('reel_ai_pack_1');
    expect(
      resolvePurchasedReelAiPack({
        amount: 1,
        currency: 'CAD',
      })
    ).toBeUndefined();
  });

  it('prices generate by tier', () => {
    expect(reelAiTokenCost('fast')).toBe(2);
    expect(reelAiTokenCost('standard')).toBe(8);
  });
});
