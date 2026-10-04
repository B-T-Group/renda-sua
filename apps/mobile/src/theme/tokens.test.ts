import { lightColors } from './colors';
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
  it('matches the web Trust Coast Blue brand hex values', () => {
    expect(lightColors.primary.main).toBe('#1E3A8A');
    expect(lightColors.secondary.main).toBe('#0F766E');
    expect(lightColors.cta.main).toBe('#C2410C');
    expect(lightColors.cta.soft).toBe('#FFEDD5');
    expect(lightColors.success.main).toBe('#15803D');
    expect(lightColors.error.main).toBe('#B91C1C');
    expect(lightColors.warning.main).toBe('#B45309');
    expect(lightColors.info.main).toBe('#0E7490');
    expect(lightColors.appBackground).toBe('#F8FAFC');
    expect(lightColors.surface).toBe('#FFFFFF');
    expect(lightColors.text.primary).toBe('#0F172A');
    expect(lightColors.text.muted).toBe('#64748B');
  });

  it.each([
    ['primary', lightColors.primary.main, lightColors.primary.contrast],
    ['cta', lightColors.cta.main, lightColors.cta.contrast],
    ['secondary', lightColors.secondary.main, lightColors.secondary.contrast],
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
    expect(typography.price.fontWeight).toBe('700');
    expect(typography.price.fontVariant).toEqual(['tabular-nums']);
    expect(typography.priceLarge.fontSize).toBeGreaterThan(typography.price.fontSize);
    expect(typography.nav.fontSize).toBe(11);
  });

  it('shares motion durations with the web theme', () => {
    expect(motion.duration).toEqual({ fast: 120, normal: 200, slow: 320 });
  });
});
