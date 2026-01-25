import { Assignment, ShoppingBag } from '@mui/icons-material';
import { Box, Paper, useTheme, useMediaQuery } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';

const ClientBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { userType } = useUserProfileContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Only show for clients on mobile
  if (userType !== 'client' || !isMobile) {
    return null;
  }

  const isItemsActive =
    location.pathname === '/items' ||
    location.pathname.startsWith('/items/');

  const isOrdersActive =
    location.pathname === '/orders' ||
    (location.pathname.startsWith('/orders/') &&
      !location.pathname.startsWith('/orders/batch') &&
      !location.pathname.startsWith('/orders/confirmation'));

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        borderTop: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        // Safe area padding for devices with notches
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
        {/* Items Tab */}
        <Box
          onClick={() => handleNavigate('/items')}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            cursor: 'pointer',
            minHeight: 48,
            color: isItemsActive ? 'primary.main' : 'text.secondary',
            backgroundColor: 'transparent',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
            '&:active': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <ShoppingBag
            sx={{
              fontSize: 24,
              color: isItemsActive ? 'primary.main' : 'text.secondary',
            }}
          />
          <Box
            component="span"
            sx={{
              fontSize: '0.75rem',
              fontWeight: isItemsActive ? 600 : 400,
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {t('common.browseItems', 'Browse Items')}
          </Box>
        </Box>

        {/* Orders Tab */}
        <Box
          onClick={() => handleNavigate('/orders')}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            cursor: 'pointer',
            minHeight: 48,
            color: isOrdersActive ? 'primary.main' : 'text.secondary',
            backgroundColor: 'transparent',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
            '&:active': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <Assignment
            sx={{
              fontSize: 24,
              color: isOrdersActive ? 'primary.main' : 'text.secondary',
            }}
          />
          <Box
            component="span"
            sx={{
              fontSize: '0.75rem',
              fontWeight: isOrdersActive ? 600 : 400,
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {t('common.orders', 'Orders')}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default ClientBottomNav;
