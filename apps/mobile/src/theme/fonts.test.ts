import { describe, expect, it } from 'vitest';
import { fontFamily, fontFamilyForWeight } from './fonts';

describe('fontFamilyForWeight', () => {
  it('pairs each weight with its Inter face', () => {
    expect(fontFamilyForWeight(undefined)).toBe(fontFamily.regular);
    expect(fontFamilyForWeight('400')).toBe(fontFamily.regular);
    expect(fontFamilyForWeight('500')).toBe(fontFamily.medium);
    expect(fontFamilyForWeight('600')).toBe(fontFamily.semibold);
    expect(fontFamilyForWeight('700')).toBe(fontFamily.bold);
    expect(fontFamilyForWeight('800')).toBe(fontFamily.bold);
    expect(fontFamilyForWeight('bold')).toBe(fontFamily.bold);
  });
});
