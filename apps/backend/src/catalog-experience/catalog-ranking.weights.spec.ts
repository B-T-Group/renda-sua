import {
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
});
