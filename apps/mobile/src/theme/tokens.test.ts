import { brandTokens } from '../../../frontend/src/theme/brandTokens';
import { darkColors, lightColors } from './colors';
import { motion } from './motion';
import { borderRadius, spacing } from './spacing';
import { typography } from './typography';

const channelLuminance = (channel: number) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (hex: string) => {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
};

const contrastRatio = (foreground: string, background: string) => {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
};

describe('mobile design tokens', () => {
  it('matches the web brand tokens', () => {
    expect(lightColors.primary.main).toBe(brandTokens.primary.main);
    expect(lightColors.primary.light).toBe(brandTokens.primary.light);
    expect(lightColors.primary.dark).toBe(brandTokens.primary.dark);
    expect(lightColors.secondary.main).toBe(brandTokens.secondary.main);
    expect(lightColors.cta.main).toBe(brandTokens.cta.main);
    expect(lightColors.cta.light).toBe(brandTokens.cta.light);
    expect(lightColors.cta.dark).toBe(brandTokens.cta.dark);
    expect(lightColors.cta.soft).toBe(brandTokens.cta.soft);
    expect(lightColors.success.main).toBe(brandTokens.success.main);
    expect(lightColors.error.main).toBe(brandTokens.error.main);
    expect(lightColors.warning.main).toBe(brandTokens.warning.main);
    expect(lightColors.info.main).toBe(brandTokens.info.main);
    expect(lightColors.appBackground).toBe(brandTokens.surface.background);
    expect(lightColors.surface).toBe(brandTokens.surface.paper);
    expect(lightColors.border).toBe(brandTokens.surface.border);
    expect(lightColors.borderStrong).toBe(brandTokens.surface.borderStrong);
    expect(lightColors.text.primary).toBe(brandTokens.text.primary);
    expect(lightColors.text.muted).toBe(brandTokens.text.muted);
    expect(lightColors.success.main).not.toBe(lightColors.cta.main);
  });

  it.each([
    ['light primary', lightColors.primary.main, lightColors.primary.contrast],
    ['light cta', lightColors.cta.main, lightColors.cta.contrast],
    ['light secondary', lightColors.secondary.main, lightColors.secondary.contrast],
    ['light success', lightColors.success.main, '#ffffff'],
    ['dark primary', darkColors.primary.main, darkColors.primary.contrast],
    ['dark cta', darkColors.cta.main, darkColors.cta.contrast],
    ['dark secondary', darkColors.secondary.main, darkColors.secondary.contrast],
    ['dark success', darkColors.success.main, '#ffffff'],
  ])('keeps white text on %s above 4.5:1', (_name, background, foreground) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps muted text readable on the app background', () => {
    expect(contrastRatio(lightColors.text.muted, lightColors.appBackground)).toBeGreaterThanOrEqual(4.5);
  });

  it('uses the shared spacing scale, including 20', () => {
    expect([
      spacing.xxs,
      spacing.xs,
      spacing.sm,
      spacing.md,
      spacing.s20,
      spacing.lg,
      spacing.xl,
      spacing.xl2,
      spacing.xxl,
      spacing.xl3,
    ]).toEqual([4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
  });

  it('keeps radii inside 8, 12 and 16 except the full pill', () => {
    expect(borderRadius.chip).toBe(8);
    expect(borderRadius.button).toBe(12);
    expect(borderRadius.card).toBe(16);
    expect(borderRadius.full).toBe(9999);
  });

  it('gives prices their own tabular role', () => {
    expect(typography.display.fontFamily).toBe('Poppins_700Bold');
    expect(typography.h2.fontFamily).toBe('Poppins_600SemiBold');
    expect(typography.price.fontFamily).toBe('Inter_700Bold');
    expect(typography.price.fontWeight).toBe('700');
    expect(typography.price.fontVariant).toEqual(['tabular-nums']);
    expect(typography.priceLarge.fontSize).toBeGreaterThan(typography.price.fontSize);
    expect(typography.nav.fontSize).toBe(11);
  });

  it('shares motion durations with the web theme', () => {
    expect(motion.duration).toEqual({ fast: 120, normal: 200, slow: 320 });
  });
});
