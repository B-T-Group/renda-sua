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
  });
});

describe('resetMarketplacePublicStatsCache', () => {
  it('clears the module cache', () => {
    expect(() => resetMarketplacePublicStatsCache()).not.toThrow();
  });
});
