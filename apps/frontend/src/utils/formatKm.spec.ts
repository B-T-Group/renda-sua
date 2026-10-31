import { formatKm, formatKmSuffix, toFiniteNumber } from './formatKm';

describe('toFiniteNumber', () => {
  it('returns a number as-is', () => {
    expect(toFiniteNumber(2.5)).toBe(2.5);
    expect(toFiniteNumber(0)).toBe(0);
  });

  it('parses a numeric string', () => {
    expect(toFiniteNumber('3.25')).toBe(3.25);
    expect(toFiniteNumber('  8  ')).toBe(8);
  });

  it('returns null for null, undefined, and blank', () => {
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber(undefined)).toBeNull();
    expect(toFiniteNumber('')).toBeNull();
    expect(toFiniteNumber('   ')).toBeNull();
  });

  it('returns null for NaN, Infinity, and non-numeric strings', () => {
    expect(toFiniteNumber(Number.NaN)).toBeNull();
    expect(toFiniteNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toFiniteNumber('abc')).toBeNull();
  });
});

describe('formatKm', () => {
  it('formats a number to one decimal', () => {
    expect(formatKm(2.5)).toBe('2.5');
    expect(formatKm(0)).toBe('0.0');
  });

  it('formats a numeric string without throwing', () => {
    expect(formatKm('3.25')).toBe('3.3');
    expect(() => formatKm('1.23')).not.toThrow();
  });

  it('returns null for null or undefined', () => {
    expect(formatKm(null)).toBeNull();
    expect(formatKm(undefined)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(formatKm(Number.NaN)).toBeNull();
    expect(formatKm('not-a-number')).toBeNull();
  });
});

describe('formatKmSuffix', () => {
  it('prefixes a formatted km value', () => {
    expect(formatKmSuffix(2.5)).toBe(' · 2.5 km');
    expect(formatKmSuffix('3.25')).toBe(' · 3.3 km');
  });

  it('returns empty for null, undefined, and NaN', () => {
    expect(formatKmSuffix(null)).toBe('');
    expect(formatKmSuffix(undefined)).toBe('');
    expect(formatKmSuffix(Number.NaN)).toBe('');
  });
});
