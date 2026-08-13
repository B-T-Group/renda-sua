import { buildLexicalItemSearchOr } from './inventory-lexical-search.util';

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
