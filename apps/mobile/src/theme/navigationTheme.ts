import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { darkColors, lightColors, type ThemeColors } from './colors';

function buildNavigationTheme(
  base: NavigationTheme,
  palette: ThemeColors,
  dark: boolean
): NavigationTheme {
  return {
    ...base,
    dark,
    colors: {
      ...base.colors,
      primary: palette.primary.main,
      background: palette.pageBackground,
      card: palette.surface,
      text: palette.text.primary,
      border: palette.divider,
      notification: palette.error.main,
    },
  };
}

export function createNavigationTheme(palette: ThemeColors, isDark: boolean): NavigationTheme {
  return buildNavigationTheme(
    isDark ? NavDarkTheme : NavLightTheme,
    palette,
    isDark
  );
}

export const navigationLightTheme = createNavigationTheme(lightColors, false);
export const navigationDarkTheme = createNavigationTheme(darkColors, true);
