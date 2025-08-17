import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1e40af', // Deep blue - represents speed, trust, and reliability
      light: '#3b82f6',
      dark: '#1e3a8a',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#16a34a', // Vibrant green - represents fast delivery and success
      light: '#22c55e',
      dark: '#15803d',
      contrastText: '#ffffff',
    },
    success: {
      main: '#16a34a', // Green for successful deliveries
      light: '#22c55e',
      dark: '#15803d',
    },
    warning: {
      main: '#f59e0b', // Amber for pending deliveries
      light: '#fbbf24',
      dark: '#d97706',
    },
    error: {
      main: '#dc2626', // Red for delivery issues
      light: '#ef4444',
      dark: '#b91c1c',
    },
    info: {
      main: '#0891b2', // Cyan for tracking information
      light: '#06b6d4',
      dark: '#0e7490',
    },
    background: {
      default: '#fbfbfd', // Apple-like light background
      paper: '#ffffff',
    },
    text: {
      primary: '#1d1d1f', // Apple's primary text color
      secondary: '#86868b', // Apple's secondary text color
    },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '3rem',
      color: '#1d1d1f',
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
    },
    h2: {
      fontWeight: 600,
      fontSize: '2.25rem',
      color: '#1d1d1f',
      letterSpacing: '-0.02em',
      lineHeight: 1.2,
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.875rem',
      color: '#1d1d1f',
      letterSpacing: '-0.015em',
      lineHeight: 1.25,
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      color: '#1d1d1f',
      letterSpacing: '-0.015em',
      lineHeight: 1.3,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      color: '#1d1d1f',
      letterSpacing: '-0.01em',
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.125rem',
      color: '#1d1d1f',
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
      color: '#1d1d1f',
      letterSpacing: '0.011em',
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.43,
      color: '#86868b',
      letterSpacing: '0.016em',
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      color: '#1d1d1f',
      lineHeight: 1.5,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      color: '#86868b',
      lineHeight: 1.57,
    },
  },
  shape: {
    borderRadius: 16, // More rounded for modern delivery app feel
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
          borderRadius: 22,
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
          boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)',
          '&:hover': {
            boxShadow: '0 6px 20px rgba(30, 64, 175, 0.35)',
          },
          '&.MuiButton-containedSecondary': {
            boxShadow: '0 4px 14px rgba(22, 163, 74, 0.25)',
            '&:hover': {
              boxShadow: '0 6px 20px rgba(22, 163, 74, 0.35)',
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
            backgroundColor: 'rgba(30, 64, 175, 0.04)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          borderRadius: 20,
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
          borderRadius: 16,
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
            borderRadius: 12,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#1e40af',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#1e40af',
              borderWidth: '2px',
            },
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#1e40af',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 600,
          fontSize: '0.75rem',
          letterSpacing: '0.025em',
        },
        colorPrimary: {
          backgroundColor: '#1e40af',
          color: '#ffffff',
        },
        colorSecondary: {
          backgroundColor: '#16a34a',
          color: '#ffffff',
        },
        colorSuccess: {
          backgroundColor: '#16a34a',
          color: '#ffffff',
        },
        colorWarning: {
          backgroundColor: '#f59e0b',
          color: '#ffffff',
        },
        colorError: {
          backgroundColor: '#dc2626',
          color: '#ffffff',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#e2e8f0',
          height: 8,
        },
        bar: {
          borderRadius: 8,
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)',
          '&:hover': {
            boxShadow: '0 6px 20px rgba(30, 64, 175, 0.35)',
          },
        },
        secondary: {
          boxShadow: '0 4px 14px rgba(22, 163, 74, 0.25)',
          '&:hover': {
            boxShadow: '0 6px 20px rgba(22, 163, 74, 0.35)',
          },
        },
      },
    },
    MuiSpeedDial: {
      styleOverrides: {
        fab: {
          boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)',
          '&:hover': {
            boxShadow: '0 6px 20px rgba(30, 64, 175, 0.35)',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiSnackbarContent-root': {
            borderRadius: 12,
          },
        },
      },
    },
  },
});
