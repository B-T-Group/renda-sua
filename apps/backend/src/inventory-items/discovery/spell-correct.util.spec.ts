import { buildVocabulary, correctQuery, editDistance, tokenize } from './spell-correct.util';

describe('spell-correct', () => {
  const vocab = buildVocabulary([
    'Samsung Galaxy Phone', 'Samsung TV', 'Samsung Fridge', 'Iphone 13 Case',
    'Rice Cooker', 'Basmati Rice', 'Rise Hat', 'Sneakers Nike', 'Sneakers Adidas',
    'Réfrigérateur', 'Mixeur',
  ]);

  it('edit distance counts transpositions as one', () => {
    expect(editDistance('samsnug', 'samsung')).toBe(1);
    expect(editDistance('abc', 'xyz', 2)).toBeGreaterThan(2);
  });
  it('corrects a clear typo', () => {
    expect(correctQuery('samsnug tv', vocab)).toBe('samsung tv');
    expect(correctQuery('sneekers', vocab)).toBe('sneakers');
  });
  it('folds accents on both sides', () => {
    expect(tokenize('Réfrigérateur')).toEqual(['refrigerateur']);
    expect(correctQuery('refrigerateurr', vocab)).toBe('refrigerateur');
  });
  it('leaves correct words, short words and unknown words alone', () => {
    expect(correctQuery('samsung tv', vocab)).toBeNull();
    expect(correctQuery('tv', vocab)).toBeNull();
    expect(correctQuery('zzzzzzzz', vocab)).toBeNull();
  });
  it('refuses ambiguous corrections (two equally good candidates)', () => {
    // "rise" exists as a word; "rica" is 1 away from "rice" only -> fine; "ricc" ties nothing
    const v = buildVocabulary(['cart', 'card']);
    expect(correctQuery('carx', v)).toBeNull();
  });
  it('requires the same first letter', () => {
    expect(correctQuery('amsung', vocab)).toBeNull();
  });
});
