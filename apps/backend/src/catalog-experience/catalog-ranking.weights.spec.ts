import {
  CATALOG_RANKING_WEIGHTS,
  rankBySignals,
  scoreCatalogCandidate,
} from './catalog-ranking.weights';

describe('catalog ranking', () => {
  it('scores a promotion above the same popularity without one', () => {
    const plain = scoreCatalogCandidate({ popularity: 10 });
    const promoted = scoreCatalogCandidate({ popularity: 10, promotion: 1 });
    expect(promoted).toBeGreaterThan(plain);
  });

  it('returns the highest scored candidates first', () => {
    const ranked = rankBySignals(
      [{ id: 'low' }, { id: 'high' }],
      (item) => ({ popularity: item.id === 'high' ? 20 : 1 }),
      1
    );
    expect(ranked).toEqual([{ id: 'high' }]);
  });

  it('rating signal has weight 1, the same tier as freshness (#342 AC-1.6)', () => {
    expect(CATALOG_RANKING_WEIGHTS.rating).toBe(1);
    expect(CATALOG_RANKING_WEIGHTS.rating).toBe(CATALOG_RANKING_WEIGHTS.freshness);
    expect(scoreCatalogCandidate({ rating: 1 })).toBe(1);
  });

  it('does not change existing scores when no rating is supplied', () => {
    expect(scoreCatalogCandidate({ popularity: 3, freshness: 0.5 })).toBe(3 + 0.5);
  });
});
