import { useTheme as useMuiTheme } from '@mui/material/styles';
import {
  componentStyles,
  getBorderRadius,
  getColorWithOpacity,
  getResponsiveSpacing,
  getShadow,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  transitions,
  breakpoints,
  typography,
} from '../theme/themeUtils';

/**
 * Enhanced useTheme hook that provides access to theme utilities and common styles
 * This hook extends the MUI useTheme hook with additional utilities for consistent styling
 */
export const useTheme = (): ReturnType<typeof useMuiTheme> & {
  utils: typeof spacing & typeof borderRadius & typeof shadows & typeof zIndex & typeof transitions & typeof breakpoints & typeof typography;
  getColorWithOpacity: (color: string, opacity: number) => string;
  getResponsiveSpacing: (spacingKey: keyof typeof spacing) => number;
  getShadow: (shadowKey: keyof typeof shadows) => string;
  getBorderRadius: (radiusKey: keyof typeof borderRadius) => string | number;
  styles: {
    card: any;
    button: any;
    input: any;
    container: any;
    section: any;
    hero: any;
    trustSignal: any;
    stepNumber: (color: string) => any;
    benefitCard: any;
    iconContainer: (color: string) => any;
  };
  colors: any;
  spacing: any;
  radius: any;
  elevation: any;
  animation: any;
} => {
  const theme = useMuiTheme();

  return {
    // Original MUI theme
    ...theme,
    
    // Theme utilities
    utils: {
      spacing,
      borderRadius,
      shadows,
      zIndex,
      transitions,
      breakpoints,
      typography,
    },

    // Utility functions
    getColorWithOpacity: (color: string, opacity: number) => 
      getColorWithOpacity(theme, color, opacity),
    getResponsiveSpacing: (spacingKey: keyof typeof spacing) => 
      getResponsiveSpacing(theme, spacingKey),
    getShadow: (shadowKey: keyof typeof shadows) => 
      getShadow(shadowKey),
    getBorderRadius: (radiusKey: keyof typeof borderRadius) => 
      getBorderRadius(radiusKey),

    // Component styles
    styles: {
      card: componentStyles.card(theme),
      button: componentStyles.button(theme),
      input: componentStyles.input(theme),
      container: componentStyles.container(theme),
      section: componentStyles.section(theme),
      hero: componentStyles.hero(theme),
      trustSignal: componentStyles.trustSignal(theme),
      stepNumber: (color: string) => componentStyles.stepNumber(theme, color),
      benefitCard: componentStyles.benefitCard(theme),
      iconContainer: (color: string) => componentStyles.iconContainer(theme, color),
    },

    // Common color combinations
    colors: {
      primary: {
        main: theme.palette.primary.main,
        light: theme.palette.primary.light,
        dark: theme.palette.primary.dark,
        contrast: theme.palette.primary.contrastText,
        withOpacity: (opacity: number) => getColorWithOpacity(theme, 'primary', opacity),
      },
      secondary: {
        main: theme.palette.secondary.main,
        light: theme.palette.secondary.light,
        dark: theme.palette.secondary.dark,
        contrast: theme.palette.secondary.contrastText,
        withOpacity: (opacity: number) => getColorWithOpacity(theme, 'secondary', opacity),
      },
      success: {
        main: theme.palette.success.main,
        light: theme.palette.success.light,
        dark: theme.palette.success.dark,
        withOpacity: (opacity: number) => getColorWithOpacity(theme, 'success', opacity),
      },
      warning: {
        main: theme.palette.warning.main,
        light: theme.palette.warning.light,
        dark: theme.palette.warning.dark,
        withOpacity: (opacity: number) => getColorWithOpacity(theme, 'warning', opacity),
      },
      error: {
        main: theme.palette.error.main,
        light: theme.palette.error.light,
        dark: theme.palette.error.dark,
        withOpacity: (opacity: number) => getColorWithOpacity(theme, 'error', opacity),
      },
      info: {
        main: theme.palette.info.main,
        light: theme.palette.info.light,
        dark: theme.palette.info.dark,
        withOpacity: (opacity: number) => getColorWithOpacity(theme, 'info', opacity),
      },
      background: {
        default: theme.palette.background.default,
        paper: theme.palette.background.paper,
        withOpacity: (opacity: number) => getColorWithOpacity(theme, 'background', opacity),
      },
      text: {
        primary: theme.palette.text.primary,
        secondary: theme.palette.text.secondary,
        disabled: theme.palette.text.disabled,
      },
    },

    // Common spacing values
    spacing: {
      xs: theme.spacing(1), // 8px
      sm: theme.spacing(2), // 16px
      md: theme.spacing(3), // 24px
      lg: theme.spacing(4), // 32px
      xl: theme.spacing(6), // 48px
      xxl: theme.spacing(8), // 64px
    },

    // Common border radius values
    radius: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      xxl: 24,
      round: '50%',
    },

    // Common shadow values
    elevation: {
      none: 'none',
      xs: '0px 1px 2px rgba(0, 0, 0, 0.05)',
      sm: '0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)',
      md: '0px 4px 6px rgba(0, 0, 0, 0.07), 0px 2px 4px rgba(0, 0, 0, 0.06)',
      lg: '0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.05)',
      xl: '0px 20px 25px rgba(0, 0, 0, 0.1), 0px 10px 10px rgba(0, 0, 0, 0.04)',
      xxl: '0px 25px 50px rgba(0, 0, 0, 0.15)',
    },

    // Animation utilities
    animation: {
      fast: '0.15s ease-out',
      normal: '0.3s ease-out',
      slow: '0.5s ease-out',
      bounce: '0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  };
};

export default useTheme;
