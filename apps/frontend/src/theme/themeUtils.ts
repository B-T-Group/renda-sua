import { alpha, Theme } from '@mui/material/styles';

/**
 * Theme utilities for consistent styling across the application
 * These utilities help avoid hardcoded values and promote theme-based styling
 */

// Spacing utilities
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// Border radius utilities
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: '50%',
} as const;

// Shadow utilities
export const shadows = {
  none: 'none',
  xs: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  sm: '0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)',
  md: '0px 4px 6px rgba(0, 0, 0, 0.07), 0px 2px 4px rgba(0, 0, 0, 0.06)',
  lg: '0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.05)',
  xl: '0px 20px 25px rgba(0, 0, 0, 0.1), 0px 10px 10px rgba(0, 0, 0, 0.04)',
  xxl: '0px 25px 50px rgba(0, 0, 0, 0.15)',
} as const;

// Z-index utilities
export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;

// Animation utilities
export const transitions = {
  fast: '0.15s ease-out',
  normal: '0.3s ease-out',
  slow: '0.5s ease-out',
  bounce: '0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

// Breakpoint utilities
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
} as const;

/**
 * Get theme-aware color with opacity
 */
export const getColorWithOpacity = (theme: Theme, color: string, opacity: number) => {
  const paletteColor = theme.palette[color as keyof typeof theme.palette];
  if (paletteColor && typeof paletteColor === 'object' && 'main' in paletteColor) {
    return alpha(paletteColor.main, opacity);
  }
  return alpha(color, opacity);
};

/**
 * Get responsive spacing
 */
export const getResponsiveSpacing = (theme: Theme, spacingKey: keyof typeof spacing) => {
  return theme.spacing(spacing[spacingKey]);
};

/**
 * Get theme-aware shadow
 */
export const getShadow = (shadow: keyof typeof shadows) => {
  return shadows[shadow];
};

/**
 * Get theme-aware border radius
 */
export const getBorderRadius = (radius: keyof typeof borderRadius) => {
  return borderRadius[radius];
};

/**
 * Common component styles that can be reused
 */
export const componentStyles = {
  // Card styles
  card: (theme: Theme) => ({
    borderRadius: getBorderRadius('lg'),
    boxShadow: getShadow('md'),
    border: `1px solid ${theme.palette.divider}`,
    transition: transitions.normal,
    '&:hover': {
      boxShadow: getShadow('lg'),
      transform: 'translateY(-2px)',
    },
  }),

  // Button styles
  button: (theme: Theme) => ({
    borderRadius: getBorderRadius('xl'),
    textTransform: 'none' as const,
    fontWeight: 600,
    transition: transitions.normal,
    '&:hover': {
      transform: 'translateY(-1px)',
    },
  }),

  // Input styles
  input: (theme: Theme) => ({
    borderRadius: getBorderRadius('md'),
    '& .MuiOutlinedInput-root': {
      borderRadius: getBorderRadius('md'),
      transition: transitions.normal,
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
        borderWidth: 2,
      },
    },
  }),

  // Container styles
  container: (theme: Theme) => ({
    padding: getResponsiveSpacing(theme, 'lg'),
    [theme.breakpoints.down('md')]: {
      padding: getResponsiveSpacing(theme, 'md'),
    },
    [theme.breakpoints.down('sm')]: {
      padding: getResponsiveSpacing(theme, 'sm'),
    },
  }),

  // Section styles
  section: (theme: Theme) => ({
    padding: `${getResponsiveSpacing(theme, 'xxl')} 0`,
    [theme.breakpoints.down('md')]: {
      padding: `${getResponsiveSpacing(theme, 'xl')} 0`,
    },
    [theme.breakpoints.down('sm')]: {
      padding: `${getResponsiveSpacing(theme, 'lg')} 0`,
    },
  }),

  // Hero section styles
  hero: (theme: Theme) => ({
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    color: theme.palette.primary.contrastText,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    '&::before': {
      content: '""',
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.08) 0%, transparent 50%)',
      pointerEvents: 'none' as const,
    },
  }),

  // Trust signal styles
  trustSignal: (theme: Theme) => ({
    display: 'flex',
    alignItems: 'center',
    gap: getResponsiveSpacing(theme, 'sm'),
    color: theme.palette.primary.contrastText,
    fontWeight: 600,
    fontSize: '0.95rem',
  }),

  // Step number styles
  stepNumber: (theme: Theme, color: string) => ({
    position: 'absolute' as const,
    top: -15,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 30,
    height: 30,
    borderRadius: getBorderRadius('round'),
    backgroundColor: color,
    color: theme.palette.primary.contrastText,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.9rem',
  }),

  // Benefit card styles
  benefitCard: (theme: Theme) => ({
    height: '100%',
    backgroundColor: theme.palette.background.paper,
    border: `2px solid ${theme.palette.primary.main}`,
    borderRadius: getBorderRadius('md'),
    transition: transitions.normal,
    '&:hover': {
      transform: 'translateY(-8px)',
      boxShadow: getShadow('xl'),
      borderColor: theme.palette.primary.dark,
    },
  }),

  // Icon container styles
  iconContainer: (theme: Theme, color: string) => ({
    width: 60,
    height: 60,
    borderRadius: getBorderRadius('round'),
    backgroundColor: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
    marginBottom: getResponsiveSpacing(theme, 'sm'),
  }),
};

/**
 * Typography utilities
 */
export const typography = {
  // Responsive font sizes
  responsive: {
    h1: {
      fontSize: { xs: '2.25rem', sm: '3rem', md: '3.5rem' },
      fontWeight: 800,
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
    },
    h2: {
      fontSize: { xs: '1.75rem', md: '2.5rem' },
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1.2,
    },
    h3: {
      fontSize: { xs: '1.5rem', md: '2rem' },
      fontWeight: 700,
      letterSpacing: '-0.015em',
      lineHeight: 1.25,
    },
    body: {
      fontSize: { xs: '1rem', md: '1.1rem' },
      lineHeight: 1.6,
    },
    caption: {
      fontSize: { xs: '0.875rem', md: '0.95rem' },
      fontWeight: 600,
    },
  },
} as const;
