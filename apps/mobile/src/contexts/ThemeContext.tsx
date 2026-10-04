import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { createTheme, lightColors, type Theme, type ThemeMode } from '../theme';
import { createPaperTheme, createNavigationTheme } from '../theme';

export type ThemeContextValue = Theme & {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  paperTheme: ReturnType<typeof createPaperTheme>;
  navigationTheme: ReturnType<typeof createNavigationTheme>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Light only until the dark palette is checked on a device. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const setMode = useCallback((_next: ThemeMode) => undefined, []);
  const value = useMemo<ThemeContextValue>(() => {
    const base = createTheme(lightColors);
    return {
      ...base,
      mode: 'light',
      isDark: false,
      setMode,
      paperTheme: createPaperTheme(lightColors, false),
      navigationTheme: createNavigationTheme(lightColors, false),
    };
  }, [setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
