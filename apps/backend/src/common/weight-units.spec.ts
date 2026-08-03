import { normalizeWeightUnit, isWeightUnit } from './weight-units';

describe('normalizeWeightUnit', () => {
  it('lowercases valid enum values', () => {
    expect(normalizeWeightUnit('Kg')).toBe('kg');
    expect(normalizeWeightUnit('KG')).toBe('kg');
    expect(normalizeWeightUnit('G')).toBe('g');
    expect(normalizeWeightUnit('Lb')).toBe('lb');
    expect(normalizeWeightUnit('OZ')).toBe('oz');
  });

  it('maps common aliases', () => {
    expect(normalizeWeightUnit('kilograms')).toBe('kg');
    expect(normalizeWeightUnit('grams')).toBe('g');
    expect(normalizeWeightUnit('lbs')).toBe('lb');
    expect(normalizeWeightUnit('ounces')).toBe('oz');
  });

  it('returns null for empty or unsupported units', () => {
    expect(normalizeWeightUnit(null)).toBeNull();
    expect(normalizeWeightUnit(undefined)).toBeNull();
    expect(normalizeWeightUnit('')).toBeNull();
    expect(normalizeWeightUnit('  ')).toBeNull();
    expect(normalizeWeightUnit('ml')).toBeNull();
    expect(normalizeWeightUnit('l')).toBeNull();
  });
});

describe('isWeightUnit', () => {
  it('accepts only enum members', () => {
    expect(isWeightUnit('kg')).toBe(true);
    expect(isWeightUnit('Kg')).toBe(false);
  });
});
