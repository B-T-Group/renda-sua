import { colors, lightColors, darkColors, type ThemeColors, type ThemeMode } from './colors';
import { typography } from './typography';
import { spacing, borderRadius, paperRoundness } from './spacing';
import { shadows } from './shadows';

export type Theme = {
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
};

export function createTheme(palette: ThemeColors): Theme {
  return {
    colors: palette,
    typography,
    spacing,
    borderRadius,
    shadows,
  };
}

/** Static light theme for rare non-React call sites. Prefer `useTheme()`. */
export const theme: Theme = createTheme(lightColors);

export {
  colors,
  lightColors,
  darkColors,
  typography,
  spacing,
  borderRadius,
  paperRoundness,
  shadows,
};
export type { ThemeColors, ThemeMode };
export { THEME_MODE_STORAGE_KEY } from './colors';
export { createPaperTheme, paperTheme, paperDarkTheme } from './paperTheme';
export {
  createNavigationTheme,
  navigationLightTheme,
  navigationDarkTheme,
} from './navigationTheme';
