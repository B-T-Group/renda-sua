import { PERSONA_HEADER_COLORS } from '../constants/personaTheme';
import { brandTokens } from './brandTokens';
import { theme } from './theme';

const channelLuminance = (channel: number) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (hex: string) => {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) =>
    parseInt(value.slice(i, i + 2), 16)
  );
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
};

const contrastRatio = (foreground: string, background: string) => {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
};

describe('Trust Coast Blue palette', () => {
  it('exposes the approved brand tokens on the MUI palette', () => {
    expect(theme.palette.primary.main).toBe('#1E3A8A');
    expect(theme.palette.secondary.main).toBe('#0F766E');
    expect(theme.palette.cta.main).toBe('#C2410C');
    expect(theme.palette.cta.soft).toBe('#FFEDD5');
    expect(theme.palette.success.main).toBe('#15803D');
    expect(theme.palette.error.main).toBe('#B91C1C');
    expect(theme.palette.warning.main).toBe('#B45309');
    expect(theme.palette.background.default).toBe('#F8FAFC');
    expect(theme.palette.background.paper).toBe('#FFFFFF');
    expect(theme.palette.text.primary).toBe('#0F172A');
    expect(theme.palette.text.secondary).toBe('#64748B');
  });

  it.each([
    ['primary', brandTokens.primary],
    ['secondary', brandTokens.secondary],
    ['cta', brandTokens.cta],
    ['success', brandTokens.success],
    ['error', brandTokens.error],
    ['warning', brandTokens.warning],
    ['info', brandTokens.info],
  ])('keeps white text on filled %s above 4.5:1', (_name, token) => {
    expect(contrastRatio(token.contrastText, token.main)).toBeGreaterThanOrEqual(
      4.5
    );
  });

  it('keeps muted text readable on the app background', () => {
    expect(
      contrastRatio(brandTokens.text.muted, brandTokens.surface.background)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('maps persona chrome to client blue, agent teal and business accent', () => {
    expect(PERSONA_HEADER_COLORS.client.main).toBe(brandTokens.primary.main);
    expect(PERSONA_HEADER_COLORS.agent.main).toBe(brandTokens.secondary.main);
    expect(PERSONA_HEADER_COLORS.business.main).toBe(brandTokens.cta.main);
  });
});
