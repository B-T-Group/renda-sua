import {
  findPackByAmount,
  findPackByDescription,
  getTokenPack,
  packPriceForCurrency,
  resolvePurchasedPack,
} from './business-tokens.packs';

describe('business token packs', () => {
  it('resolves packs from exact supported-currency amounts', () => {
    expect(findPackByAmount(15, 'CAD')?.id).toBe('pack_1000');
    expect(findPackByAmount(20000, 'xaf')?.id).toBe('pack_5000');
  });

  it('does not resolve packs from unsupported currency amounts', () => {
    expect(findPackByAmount(15, 'USD')).toBeUndefined();
  });

  it('falls back to token count embedded in payment descriptions', () => {
    expect(findPackByDescription('AI tokens pack 100')?.id).toBe('pack_100');
    expect(findPackByDescription('AI tokens 5000')?.id).toBe('pack_5000');
    expect(findPackByDescription('tokens 5000')).toBeUndefined();
  });

  it('prefers amount matching over a conflicting description fallback', () => {
    expect(
      resolvePurchasedPack({
        amount: 2,
        currency: 'CAD',
        description: 'AI tokens pack 5000',
      })?.id
    ).toBe('pack_100');
  });

  it('returns supported prices and rejects unsupported currencies', () => {
    const pack = getTokenPack('pack_1000');

    expect(pack).toBeDefined();
    expect(packPriceForCurrency(pack!, 'cad')).toBe(15);
    expect(packPriceForCurrency(pack!, 'XAF')).toBe(6000);
    expect(packPriceForCurrency(pack!, 'USD')).toBeNull();
  });
});
