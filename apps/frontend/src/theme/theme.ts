import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb', // Bright blue - represents speed and reliability
      light: '#3b82f6',
      dark: '#1d4ed8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#059669', // Green - represents success and delivery completion
      light: '#10b981',
      dark: '#047857',
      contrastText: '#ffffff',
    },
    success: {
      main: '#059669', // Green for successful deliveries
      light: '#10b981',
      dark: '#047857',
    },
    warning: {
      main: '#d97706', // Orange for pending deliveries
      light: '#f59e0b',
      dark: '#b45309',
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
      default: '#f8fafc', // Light gray background
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b', // Dark slate for primary text
      secondary: '#64748b', // Medium gray for secondary text
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      color: '#1e293b',
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
      color: '#1e293b',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
      color: '#1e293b',
    },
    h4: {
      fontWeight: 500,
      fontSize: '1.5rem',
      color: '#1e293b',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.25rem',
      color: '#1e293b',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1rem',
      color: '#1e293b',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '0.875rem',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
  },
  shape: {
    borderRadius: 12, // Slightly more rounded for modern delivery app feel
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 24px',
          fontSize: '0.875rem',
          fontWeight: 600,
          textTransform: 'none',
          transition: 'all 0.2s ease-in-out',
        },
        contained: {
          boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)',
          '&:hover': {
            boxShadow: '0 6px 12px rgba(37, 99, 235, 0.3)',
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          borderRadius: 16,
          border: '1px solid rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          borderRadius: 0,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#2563eb',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#2563eb',
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
        colorPrimary: {
          backgroundColor: '#2563eb',
          color: '#ffffff',
        },
        colorSecondary: {
          backgroundColor: '#059669',
          color: '#ffffff',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: '#e2e8f0',
        },
        bar: {
          borderRadius: 4,
        },
      },
    },
  },
}); 