import { HelpOutline, Home, ShoppingBag } from '@mui/icons-material';
import { Box, Paper, useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

const GuestBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Only show for unauthenticated users on mobile
  if (isAuthenticated || !isMobile) {
    return null;
  }

  const isHomeActive = location.pathname === '/';
  const isItemsActive =
    location.pathname === '/items' || location.pathname.startsWith('/items/');
  const isSupportActive = location.pathname === '/support';

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const navItemSx = (active: boolean) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.5,
    cursor: 'pointer',
    minHeight: 48,
    color: active ? 'primary.main' : 'text.secondary',
    backgroundColor: 'transparent',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      backgroundColor: 'action.hover',
    },
    '&:active': {
      backgroundColor: 'action.hover',
    },
  });

  const labelSx = (active: boolean) => ({
    fontSize: '0.75rem',
    fontWeight: active ? 600 : 400,
    textAlign: 'center',
    lineHeight: 1.2,
  });

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        borderRadius: 0,
        borderTop: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
        display: { xs: 'block', md: 'none' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          height: 64,
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
      >
        {/* Home */}
        <Box
          onClick={() => handleNavigate('/')}
          sx={navItemSx(isHomeActive)}
          role="button"
          aria-label={t('common.home', 'Home')}
        >
          <Home
            sx={{
              fontSize: 24,
              color: isHomeActive ? 'primary.main' : 'text.secondary',
            }}
          />
          <Box component="span" sx={labelSx(isHomeActive)}>
            {t('common.home', 'Home')}
          </Box>
        </Box>

        {/* Browse Items */}
        <Box
          onClick={() => handleNavigate('/items')}
          sx={navItemSx(isItemsActive)}
          role="button"
          aria-label={t('common.browseItems', 'Browse Items')}
        >
          <ShoppingBag
            sx={{
              fontSize: 24,
              color: isItemsActive ? 'primary.main' : 'text.secondary',
            }}
          />
          <Box component="span" sx={labelSx(isItemsActive)}>
            {t('common.browseItems', 'Browse Items')}
          </Box>
        </Box>

        {/* Support */}
        <Box
          onClick={() => handleNavigate('/support')}
          sx={navItemSx(isSupportActive)}
          role="button"
          aria-label={t('nav.support', 'Support')}
        >
          <HelpOutline
            sx={{
              fontSize: 24,
              color: isSupportActive ? 'primary.main' : 'text.secondary',
            }}
          />
          <Box component="span" sx={labelSx(isSupportActive)}>
            {t('nav.support', 'Support')}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default GuestBottomNav;
