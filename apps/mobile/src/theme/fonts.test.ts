import { describe, expect, it } from 'vitest';
import { brandFaceStyle, fontFamily, fontFamilyForWeight, withBrandPaperFonts } from './fonts';

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

describe('withBrandPaperFonts', () => {
  const typescale = {
    headlineSmall: {
      fontFamily: 'System',
      fontWeight: '400' as const,
      fontSize: 24,
      lineHeight: 32,
      letterSpacing: 0,
    },
    bodyMedium: {
      fontFamily: 'System',
      fontWeight: '400' as const,
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
    labelLarge: {
      fontFamily: 'System',
      fontWeight: '500' as const,
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.1,
    },
    titleMedium: {
      fontFamily: 'System',
      fontWeight: '500' as const,
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: 0.15,
    },
  };

  it('maps Paper dialog title, body and button variants to Inter and keeps sizes', () => {
    const fonts = withBrandPaperFonts(typescale, 'ios');
    expect(fonts.headlineSmall).toEqual({
      ...typescale.headlineSmall,
      fontFamily: fontFamily.regular,
    });
    expect(fonts.bodyMedium.fontFamily).toBe(fontFamily.regular);
    expect(fonts.labelLarge.fontFamily).toBe(fontFamily.medium);
    expect(fonts.titleMedium.fontFamily).toBe(fontFamily.medium);
    expect(fonts.headlineSmall.fontSize).toBe(24);
    expect(fonts.headlineSmall.lineHeight).toBe(32);
    expect(fonts.labelLarge.letterSpacing).toBe(0.1);
    expect(fonts.labelLarge.fontWeight).toBe('500');
  });

  it('resets weight to normal on Android so medium/bold faces are not synthesized', () => {
    const fonts = withBrandPaperFonts(typescale, 'android');
    expect(fonts.headlineSmall).toEqual({
      fontFamily: fontFamily.regular,
      fontWeight: 'normal',
      fontSize: 24,
      lineHeight: 32,
      letterSpacing: 0,
    });
    expect(fonts.labelLarge).toMatchObject({
      fontFamily: fontFamily.medium,
      fontWeight: 'normal',
      fontSize: 14,
    });
  });

  it('keeps typescale weights on web and iOS (family suffix comes from brandFace at load)', () => {
    const fonts = withBrandPaperFonts(typescale, 'web');
    expect(fonts.headlineSmall.fontFamily).toBe(fontFamily.regular);
    expect(fonts.labelLarge.fontFamily).toBe(fontFamily.medium);
    expect(fonts.labelLarge.fontWeight).toBe('500');
    expect(fonts.headlineSmall.fontWeight).toBe('400');
  });
});
