import { rentalCategoryIcon, rentalCategoryLabel, splitTopCategories } from './rentalCategoryIcon';

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

  it('translates the seeded English category names and leaves stored names alone', () => {
    const fr: Record<string, string> = {
      'rentals.searchFirst.categoryEquipment': 'Équipement',
      'rentals.searchFirst.categoryOther': 'Autre',
      'rentals.searchFirst.categoryVehicles': 'Véhicules',
      'rentals.searchFirst.categoryEvents': 'Événements',
    };
    const translate = (key: string, fallback: string) => fr[key] ?? fallback;
    expect(rentalCategoryLabel('Equipment', translate)).toBe('Équipement');
    expect(rentalCategoryLabel(' other ', translate)).toBe('Autre');
    expect(rentalCategoryLabel('Écouteur sans fils', translate)).toBe('Écouteur sans fils');
    expect(rentalCategoryLabel('Téléphone', translate)).toBe('Téléphone');
  });

  it('keeps five tiles beside More', () => {
    const names = ['Equipment', 'Audio', 'Phone', 'Other', 'Cameras', 'Drones'];
    expect(splitTopCategories(names)).toEqual({
      shown: ['Equipment', 'Audio', 'Phone', 'Other', 'Cameras'],
      extra: ['Drones'],
    });
  });
});
