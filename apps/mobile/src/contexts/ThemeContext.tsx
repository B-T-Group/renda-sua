import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import {
  createTheme,
  darkColors,
  lightColors,
  type Theme,
  type ThemeMode,
} from '../theme';
import {
  THEME_MODE_STORAGE_KEY,
  createPaperTheme,
  createNavigationTheme,
} from '../theme';
import StorageService from '../services/storage/StorageService';

export type ThemeContextValue = Theme & {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  paperTheme: ReturnType<typeof createPaperTheme>;
  navigationTheme: ReturnType<typeof createNavigationTheme>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveIsDark(mode: ThemeMode, system: ColorSchemeName): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return system === 'dark';
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    () => Appearance.getColorScheme() ?? 'light'
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    void StorageService.getString(THEME_MODE_STORAGE_KEY).then((saved) => {
      if (!mounted) return;
      if (isThemeMode(saved)) setModeState(saved);
      setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void StorageService.setString(THEME_MODE_STORAGE_KEY, next);
  }, []);

  const isDark = resolveIsDark(mode, systemScheme);
  const palette = isDark ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(() => {
    const base = createTheme(palette);
    return {
      ...base,
      mode,
      isDark,
      setMode,
      paperTheme: createPaperTheme(palette, isDark),
      navigationTheme: createNavigationTheme(palette, isDark),
    };
  }, [palette, mode, isDark, setMode]);

  // Avoid a flash of the wrong scheme once storage loads.
  if (!hydrated) {
    const boot = createTheme(lightColors);
    const bootValue: ThemeContextValue = {
      ...boot,
      mode: 'system',
      isDark: false,
      setMode,
      paperTheme: createPaperTheme(lightColors, false),
      navigationTheme: createNavigationTheme(lightColors, false),
    };
    return (
      <ThemeContext.Provider value={bootValue}>{children}</ThemeContext.Provider>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
