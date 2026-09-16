import { REEL_CREDIT_PACKS, getReelCreditPack } from './reel-boosts.packs';

describe('reel-boosts packs', () => {
  it('defines CAD and XAF prices for each pack', () => {
    for (const pack of REEL_CREDIT_PACKS) {
      expect(pack.prices.CAD).toBeGreaterThan(0);
      expect(pack.prices.XAF).toBeGreaterThan(0);
    }
  });

  it('resolves pack by id', () => {
    expect(getReelCreditPack('reel_pack_5')?.credits).toBe(5);
  });
});
