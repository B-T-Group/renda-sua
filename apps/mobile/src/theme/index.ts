import { colors, lightColors, darkColors, type ThemeColors, type ThemeMode } from './colors';
import { typography } from './typography';
import { spacing, borderRadius, paperRoundness } from './spacing';
import { shadows } from './shadows';
import { motion } from './motion';

export type Theme = {
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  motion: typeof motion;
};

export function createTheme(palette: ThemeColors): Theme {
  return {
    colors: palette,
    typography,
    spacing,
    borderRadius,
    shadows,
    motion,
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
  motion,
};
export type { ThemeColors, ThemeMode };
export { fontFamily } from './fonts';
export type { MotionSpeed } from './motion';
export { THEME_MODE_STORAGE_KEY } from './colors';
export { createPaperTheme, paperTheme, paperDarkTheme } from './paperTheme';
export {
  createNavigationTheme,
  navigationLightTheme,
  navigationDarkTheme,
} from './navigationTheme';
