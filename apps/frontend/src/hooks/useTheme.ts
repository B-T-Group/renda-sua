import { useTheme as useMuiTheme } from '@mui/material/styles';
import {
  borderRadius,
  breakpoints,
  componentStyles,
  getBorderRadius,
  getColorWithOpacity,
  getResponsiveSpacing,
  getShadow,
  shadows,
  spacing,
  transitions,
  typography,
  zIndex,
} from '../theme/themeUtils';

/**
 * Enhanced useTheme hook that provides access to theme utilities and common styles
 * This hook extends the MUI useTheme hook with additional utilities for consistent styling
 */
export const useTheme = (): any => {
  const muiTheme = useMuiTheme();

  return {
    // Original MUI theme properties
    ...muiTheme,

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
      getColorWithOpacity(muiTheme, color, opacity),
    getResponsiveSpacing: (spacingKey: keyof typeof spacing) =>
      getResponsiveSpacing(muiTheme, spacingKey),
    getShadow: (shadowKey: keyof typeof shadows) => getShadow(shadowKey),
    getBorderRadius: (radiusKey: keyof typeof borderRadius) =>
      getBorderRadius(radiusKey),

    // Component styles
    styles: {
      card: componentStyles.card(muiTheme),
      button: componentStyles.button(muiTheme),
      input: componentStyles.input(muiTheme),
      container: componentStyles.container(muiTheme),
      section: componentStyles.section(muiTheme),
      hero: componentStyles.hero(muiTheme),
      trustSignal: componentStyles.trustSignal(muiTheme),
      stepNumber: (color: string) =>
        componentStyles.stepNumber(muiTheme, color),
      benefitCard: componentStyles.benefitCard(muiTheme),
      iconContainer: (color: string) =>
        componentStyles.iconContainer(muiTheme, color),
    },

    // Common color combinations
    colors: {
      primary: {
        main: muiTheme.palette.primary.main,
        light: muiTheme.palette.primary.light,
        dark: muiTheme.palette.primary.dark,
        contrast: muiTheme.palette.primary.contrastText,
        withOpacity: (opacity: number) =>
          getColorWithOpacity(muiTheme, 'primary', opacity),
      },
      secondary: {
        main: muiTheme.palette.secondary.main,
        light: muiTheme.palette.secondary.light,
        dark: muiTheme.palette.secondary.dark,
        contrast: muiTheme.palette.secondary.contrastText,
        withOpacity: (opacity: number) =>
          getColorWithOpacity(muiTheme, 'secondary', opacity),
      },
      success: {
        main: muiTheme.palette.success.main,
        light: muiTheme.palette.success.light,
        dark: muiTheme.palette.success.dark,
        withOpacity: (opacity: number) =>
          getColorWithOpacity(muiTheme, 'success', opacity),
      },
      warning: {
        main: muiTheme.palette.warning.main,
        light: muiTheme.palette.warning.light,
        dark: muiTheme.palette.warning.dark,
        withOpacity: (opacity: number) =>
          getColorWithOpacity(muiTheme, 'warning', opacity),
      },
      error: {
        main: muiTheme.palette.error.main,
        light: muiTheme.palette.error.light,
        dark: muiTheme.palette.error.dark,
        withOpacity: (opacity: number) =>
          getColorWithOpacity(muiTheme, 'error', opacity),
      },
      info: {
        main: muiTheme.palette.info.main,
        light: muiTheme.palette.info.light,
        dark: muiTheme.palette.info.dark,
        withOpacity: (opacity: number) =>
          getColorWithOpacity(muiTheme, 'info', opacity),
      },
      background: {
        default: muiTheme.palette.background.default,
        paper: muiTheme.palette.background.paper,
        withOpacity: (opacity: number) =>
          getColorWithOpacity(muiTheme, 'background', opacity),
      },
      text: {
        primary: muiTheme.palette.text.primary,
        secondary: muiTheme.palette.text.secondary,
        disabled: muiTheme.palette.text.disabled,
      },
    },

    // Common spacing values
    spacing: {
      xs: muiTheme.spacing(1), // 8px
      sm: muiTheme.spacing(2), // 16px
      md: muiTheme.spacing(3), // 24px
      lg: muiTheme.spacing(4), // 32px
      xl: muiTheme.spacing(6), // 48px
      xxl: muiTheme.spacing(8), // 64px
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
