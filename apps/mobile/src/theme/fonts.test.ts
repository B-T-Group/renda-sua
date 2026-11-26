import { describe, expect, it } from 'vitest';
import { brandFaceStyle, fontFamily, fontFamilyForWeight } from './fonts';

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

describe('brandFaceStyle (R5)', () => {
  it('keeps the bold Inter face on Android without asking Android for a bold variant', () => {
    expect(brandFaceStyle('800', 'android')).toEqual({ fontFamily: fontFamily.bold, fontWeight: 'normal' });
    expect(brandFaceStyle('600', 'android')).toEqual({ fontFamily: fontFamily.semibold, fontWeight: 'normal' });
  });

  it('leaves the weight alone on iOS and web', () => {
    expect(brandFaceStyle('800', 'ios')).toEqual({ fontFamily: fontFamily.bold });
    expect(brandFaceStyle(undefined, 'web')).toEqual({ fontFamily: fontFamily.regular });
  });
});
