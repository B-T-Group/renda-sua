import {
  formatMarketplaceStat,
  resetMarketplacePublicStatsCache,
} from './useMarketplacePublicStats';

describe('formatMarketplaceStat', () => {
  it('formats marketing-friendly counts', () => {
    expect(formatMarketplaceStat(0)).toBe('0');
    expect(formatMarketplaceStat(7)).toBe('7');
    expect(formatMarketplaceStat(42)).toBe('40+');
    expect(formatMarketplaceStat(1250)).toBe('1.2k+');
    expect(formatMarketplaceStat(99)).toBe('90+');
    expect(formatMarketplaceStat(149)).toBe('100+');
    expect(formatMarketplaceStat(10000)).toBe('10k+');
    expect(formatMarketplaceStat(-3)).toBe('0');
  });
});

describe('resetMarketplacePublicStatsCache', () => {
  it('clears the module cache', () => {
    expect(() => resetMarketplacePublicStatsCache()).not.toThrow();
  });
});
