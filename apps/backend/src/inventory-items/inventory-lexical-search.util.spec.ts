import {
  buildLexicalItemSearchOr,
  buildStoreNameSearchOr,
} from './inventory-lexical-search.util';

describe('buildLexicalItemSearchOr', () => {
  it('matches name, description, sku, and brand', () => {
    const clause = buildLexicalItemSearchOr('phone');
    expect(clause).toEqual({
      _or: [
        { item: { name: { _ilike: '%phone%' } } },
        { item: { description: { _ilike: '%phone%' } } },
        { item: { sku: { _ilike: '%phone%' } } },
        { item: { brand: { name: { _ilike: '%phone%' } } } },
      ],
    });
  });
});

describe('buildStoreNameSearchOr', () => {
  it('matches location name or business name', () => {
    const clause = buildStoreNameSearchOr('Acme');
    expect(clause).toEqual({
      _or: [
        { business_location: { name: { _ilike: '%Acme%' } } },
        {
          business_location: {
            business: { name: { _ilike: '%Acme%' } },
          },
        },
      ],
    });
  });
});
