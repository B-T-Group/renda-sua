import { layoutProviderIds } from './catalog-layout.policy';

describe('catalog layout policy', () => {
  it('leads a cold discovery home with categories', () => {
    expect(layoutProviderIds({ layout: 'discovery', isReturning: false })[0]).toBe(
      'categories'
    );
  });

  it('leads a returning shopper with recently viewed', () => {
    expect(
      layoutProviderIds({ layout: 'discovery', isReturning: true })
    ).toEqual([
      'recently-viewed',
      'categories',
      'deals',
      'collections',
      'grid',
    ]);
  });

  it('keeps search and filters on the product grid', () => {
    expect(layoutProviderIds({ layout: 'results', isReturning: true })).toEqual([
      'grid',
    ]);
  });
});
