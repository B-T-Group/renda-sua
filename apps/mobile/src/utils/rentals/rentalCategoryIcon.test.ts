import { rentalCategoryIcon, splitTopCategories } from './rentalCategoryIcon';

describe('rental category icons', () => {
  it('gives the live top categories distinct icons and falls back for unknown names', () => {
    expect(rentalCategoryIcon('Equipment')).toBe('toolbox');
    expect(rentalCategoryIcon('Écouteur sans fils')).toBe('headphones');
    expect(rentalCategoryIcon('Téléphone')).toBe('cellphone');
    expect(rentalCategoryIcon('Other')).toBe('shape-outline');
    expect(rentalCategoryIcon('Mystery crate')).toBe('tag-outline');
    const icons = ['Equipment', 'Écouteur sans fils', 'Téléphone', 'Other'].map(rentalCategoryIcon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('keeps five tiles beside More', () => {
    const names = ['Equipment', 'Audio', 'Phone', 'Other', 'Cameras', 'Drones'];
    expect(splitTopCategories(names)).toEqual({
      shown: ['Equipment', 'Audio', 'Phone', 'Other', 'Cameras'],
      extra: ['Drones'],
    });
  });
});
