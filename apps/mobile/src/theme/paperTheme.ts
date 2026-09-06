import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { darkColors, lightColors, type ThemeColors } from './colors';
import { paperRoundness } from './spacing';

function buildPaperTheme(base: typeof MD3LightTheme, palette: ThemeColors) {
  return {
    ...base,
    roundness: paperRoundness,
    colors: {
      ...base.colors,
      primary: palette.primary.main,
      onPrimary: palette.primary.contrast,
      primaryContainer: palette.primaryTint,
      onPrimaryContainer: palette.primary.dark,
      secondary: palette.secondary.main,
      onSecondary: palette.secondary.contrast,
      error: palette.error.main,
      onError: palette.onDark,
      background: palette.pageBackground,
      surface: palette.surface,
      surfaceVariant: palette.surfaceElevated,
      onSurface: palette.text.primary,
      onSurfaceVariant: palette.text.secondary,
      outline: palette.divider,
      surfaceDisabled: palette.disabled,
      onSurfaceDisabled: palette.disabledText,
      elevation: {
        ...base.colors.elevation,
        level1: palette.surface,
        level2: palette.surfaceElevated,
        level3: palette.surfaceElevated,
        level4: palette.surfaceElevated,
        level5: palette.surfaceElevated,
      },
    },
  };
}

export function createPaperTheme(palette: ThemeColors, isDark: boolean) {
  return buildPaperTheme(isDark ? MD3DarkTheme : MD3LightTheme, palette);
}

/** Default light Paper theme (static). Prefer createPaperTheme with active palette. */
export const paperTheme = createPaperTheme(lightColors, false);

export const paperDarkTheme = createPaperTheme(darkColors, true);
