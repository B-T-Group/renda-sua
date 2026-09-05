import { alpha, createTheme } from '@mui/material/styles';
import { brandTokens } from './brandTokens';
import { spacing, borderRadius, shadows, transitions } from './themeUtils';

const { primary, secondary, cta, success, warning, error, info, surface, text } =
  brandTokens;

const brandShadow = (color: string, opacity: number, blur: number, y: number) =>
  `0 ${y}px ${blur}px ${alpha(color, opacity)}`;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary, // Trust Coast Blue - app chrome, links and secondary actions
    secondary, // Deep teal - delivery and agent chrome
    cta, // Purchase accent - Buy / Pay / Checkout only
    success,
    warning,
    error,
    info,
    background: {
      default: surface.background,
      paper: surface.paper,
    },
    text: {
      primary: text.primary,
      secondary: text.muted,
    },
    divider: surface.divider,
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '3rem',
      color: text.primary,
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
    },
    h2: {
      fontWeight: 600,
      fontSize: '2.25rem',
      color: text.primary,
      letterSpacing: '-0.02em',
      lineHeight: 1.2,
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.875rem',
      color: text.primary,
      letterSpacing: '-0.015em',
      lineHeight: 1.25,
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      color: text.primary,
      letterSpacing: '-0.015em',
      lineHeight: 1.3,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      color: text.primary,
      letterSpacing: '-0.01em',
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.125rem',
      color: text.primary,
      letterSpacing: '-0.01em',
      lineHeight: 1.4,
    },
    button: {
      textTransform: 'none',
      fontWeight: 400,
      fontSize: '0.875rem',
      letterSpacing: '0',
    },
    body1: {
      fontSize: '1.0625rem',
      fontWeight: 400,
      lineHeight: 1.47,
      color: text.primary,
      letterSpacing: '0.011em',
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.43,
      color: text.muted,
      letterSpacing: '0.016em',
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      color: text.primary,
      lineHeight: 1.5,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      color: text.muted,
      lineHeight: 1.57,
    },
  },
  shape: {
    borderRadius: 12, // Moderately rounded for a cleaner look
  },
  // Custom theme utilities
  custom: {
    spacing,
    borderRadius,
    shadows,
    transitions,
    // Additional design tokens
    zIndex: {
      dropdown: 1000,
      sticky: 1020,
      fixed: 1030,
      modalBackdrop: 1040,
      modal: 1050,
      popover: 1060,
      tooltip: 1070,
    },
    breakpoints: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  shadows: [
    'none',
    '0px 2px 1px -1px rgba(0,0,0,0.05),0px 1px 1px 0px rgba(0,0,0,0.03),0px 1px 3px 0px rgba(0,0,0,0.02)',
    '0px 3px 1px -2px rgba(0,0,0,0.05),0px 2px 2px 0px rgba(0,0,0,0.03),0px 1px 5px 0px rgba(0,0,0,0.02)',
    '0px 3px 3px -2px rgba(0,0,0,0.05),0px 3px 4px 0px rgba(0,0,0,0.03),0px 1px 8px 0px rgba(0,0,0,0.02)',
    '0px 2px 4px -1px rgba(0,0,0,0.05),0px 4px 5px 0px rgba(0,0,0,0.03),0px 1px 10px 0px rgba(0,0,0,0.02)',
    '0px 3px 5px -1px rgba(0,0,0,0.05),0px 5px 8px 0px rgba(0,0,0,0.03),0px 1px 14px 0px rgba(0,0,0,0.02)',
    '0px 3px 5px -1px rgba(0,0,0,0.05),0px 6px 10px 0px rgba(0,0,0,0.03),0px 1px 18px 0px rgba(0,0,0,0.02)',
    '0px 4px 5px -2px rgba(0,0,0,0.05),0px 7px 10px 1px rgba(0,0,0,0.03),0px 2px 16px 1px rgba(0,0,0,0.02)',
    '0px 5px 5px -3px rgba(0,0,0,0.05),0px 8px 10px 1px rgba(0,0,0,0.03),0px 3px 14px 2px rgba(0,0,0,0.02)',
    '0px 5px 6px -3px rgba(0,0,0,0.05),0px 9px 12px 1px rgba(0,0,0,0.03),0px 3px 16px 2px rgba(0,0,0,0.02)',
    '0px 6px 6px -3px rgba(0,0,0,0.05),0px 10px 14px 1px rgba(0,0,0,0.03),0px 4px 18px 3px rgba(0,0,0,0.02)',
    '0px 6px 7px -4px rgba(0,0,0,0.05),0px 11px 15px 1px rgba(0,0,0,0.03),0px 4px 20px 3px rgba(0,0,0,0.02)',
    '0px 7px 8px -4px rgba(0,0,0,0.05),0px 12px 17px 2px rgba(0,0,0,0.03),0px 5px 22px 4px rgba(0,0,0,0.02)',
    '0px 7px 8px -4px rgba(0,0,0,0.05),0px 13px 19px 2px rgba(0,0,0,0.03),0px 5px 24px 4px rgba(0,0,0,0.02)',
    '0px 7px 9px -4px rgba(0,0,0,0.05),0px 14px 21px 2px rgba(0,0,0,0.03),0px 5px 26px 4px rgba(0,0,0,0.02)',
    '0px 8px 9px -5px rgba(0,0,0,0.05),0px 15px 22px 2px rgba(0,0,0,0.03),0px 6px 28px 5px rgba(0,0,0,0.02)',
    '0px 8px 10px -5px rgba(0,0,0,0.05),0px 16px 24px 2px rgba(0,0,0,0.03),0px 6px 30px 5px rgba(0,0,0,0.02)',
    '0px 8px 11px -5px rgba(0,0,0,0.05),0px 17px 26px 2px rgba(0,0,0,0.03),0px 6px 32px 5px rgba(0,0,0,0.02)',
    '0px 9px 11px -5px rgba(0,0,0,0.05),0px 18px 28px 2px rgba(0,0,0,0.03),0px 7px 34px 6px rgba(0,0,0,0.02)',
    '0px 9px 12px -6px rgba(0,0,0,0.05),0px 19px 29px 2px rgba(0,0,0,0.03),0px 7px 36px 6px rgba(0,0,0,0.02)',
    '0px 10px 13px -6px rgba(0,0,0,0.05),0px 20px 31px 3px rgba(0,0,0,0.03),0px 8px 38px 7px rgba(0,0,0,0.02)',
    '0px 10px 13px -6px rgba(0,0,0,0.05),0px 21px 33px 3px rgba(0,0,0,0.03),0px 8px 40px 7px rgba(0,0,0,0.02)',
    '0px 10px 14px -6px rgba(0,0,0,0.05),0px 22px 35px 3px rgba(0,0,0,0.03),0px 8px 42px 7px rgba(0,0,0,0.02)',
    '0px 11px 14px -7px rgba(0,0,0,0.05),0px 23px 36px 3px rgba(0,0,0,0.03),0px 9px 44px 8px rgba(0,0,0,0.02)',
    '0px 11px 15px -7px rgba(0,0,0,0.05),0px 24px 38px 3px rgba(0,0,0,0.03),0px 9px 46px 8px rgba(0,0,0,0.02)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          padding: '8px 20px',
          fontSize: '0.875rem',
          fontWeight: 400,
          textTransform: 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          letterSpacing: '0',
          minHeight: '44px',
          '&:hover': {
            transform: 'none',
          },
        },
        contained: {
          boxShadow: brandShadow(primary.main, 0.25, 14, 4),
          '&:hover': {
            boxShadow: brandShadow(primary.main, 0.35, 20, 6),
          },
          '&.Mui-disabled': {
            boxShadow: 'none',
          },
          '&.MuiButton-containedSecondary': {
            boxShadow: brandShadow(secondary.main, 0.25, 14, 4),
            '&:hover': {
              boxShadow: brandShadow(secondary.main, 0.35, 20, 6),
            },
          },
          // Purchase intent: Buy / Pay / Checkout carry extra weight
          '&.MuiButton-containedCta': {
            fontWeight: 600,
            boxShadow: brandShadow(cta.main, 0.3, 14, 4),
            '&:hover': {
              backgroundColor: cta.dark,
              boxShadow: brandShadow(cta.main, 0.4, 20, 6),
            },
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
          },
        },
        text: {
          '&:hover': {
            backgroundColor: alpha(primary.main, 0.04),
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          borderRadius: 14,
          border: '1px solid rgba(0, 0, 0, 0.04)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
          borderRadius: 0,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        },
        elevation2: {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        },
        elevation3: {
          boxShadow: '0 6px 16px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: primary.main,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: primary.main,
              borderWidth: '2px',
            },
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: primary.main,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 600,
          fontSize: '0.75rem',
          letterSpacing: '0.025em',
        },
        // Solid fills are scoped to filled chips so outlined chips stay outlined.
        // Every pairing below clears 4.5:1 against white text.
        colorPrimary: {
          '&.MuiChip-filled': {
            backgroundColor: primary.main,
            color: primary.contrastText,
          },
        },
        colorSecondary: {
          '&.MuiChip-filled': {
            backgroundColor: secondary.main,
            color: secondary.contrastText,
          },
        },
        colorSuccess: {
          '&.MuiChip-filled': {
            backgroundColor: success.main,
            color: success.contrastText,
          },
        },
        colorWarning: {
          '&.MuiChip-filled': {
            backgroundColor: warning.main,
            color: warning.contrastText,
          },
        },
        colorError: {
          '&.MuiChip-filled': {
            backgroundColor: error.main,
            color: error.contrastText,
          },
        },
        colorInfo: {
          '&.MuiChip-filled': {
            backgroundColor: info.main,
            color: info.contrastText,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        // Blockers read as soft cards with a left accent rather than solid
        // colour-on-colour banners.
        standard: {
          borderRadius: 12,
          borderLeft: '4px solid currentColor',
          alignItems: 'flex-start',
        },
        outlined: {
          borderRadius: 12,
          borderLeftWidth: 4,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          backgroundColor: surface.divider,
          height: 8,
        },
        bar: {
          borderRadius: 6,
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: brandShadow(primary.main, 0.25, 14, 4),
          '&:hover': {
            boxShadow: brandShadow(primary.main, 0.35, 20, 6),
          },
        },
        secondary: {
          boxShadow: brandShadow(secondary.main, 0.25, 14, 4),
          '&:hover': {
            boxShadow: brandShadow(secondary.main, 0.35, 20, 6),
          },
        },
      },
    },
    MuiSpeedDial: {
      styleOverrides: {
        fab: {
          boxShadow: brandShadow(primary.main, 0.25, 14, 4),
          '&:hover': {
            boxShadow: brandShadow(primary.main, 0.35, 20, 6),
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiSnackbarContent-root': {
            borderRadius: 10,
          },
        },
      },
    },
  },
});
