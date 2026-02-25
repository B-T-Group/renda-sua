import { Assignment, LocalShipping } from '@mui/icons-material';
import { Badge, Box, Paper, useTheme, useMediaQuery } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAgentEarningsSummary } from '../../hooks/useAgentEarningsSummary';
import { useUserProfileContext } from '../../contexts/UserProfileContext';

const AgentBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { userType } = useUserProfileContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { summary } = useAgentEarningsSummary(userType === 'agent' && isMobile);

  const activeOrderCount = summary?.activeOrderCount ?? 0;

  // Only show for agents on mobile
  if (userType !== 'agent' || !isMobile) {
    return null;
  }

  const isAvailableOrdersActive = location.pathname === '/open-orders';
  // Active orders is active for /orders or /orders/:orderId (but not /orders/batch, /orders/confirmation, etc.)
  const isActiveOrdersActive =
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
        borderRadius: 0,
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
        {/* Available Orders Tab */}
        <Box
          onClick={() => handleNavigate('/open-orders')}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            cursor: 'pointer',
            minHeight: 48,
            color: isAvailableOrdersActive
              ? 'primary.main'
              : 'text.secondary',
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
          <LocalShipping
            sx={{
              fontSize: 24,
              color: isAvailableOrdersActive
                ? 'primary.main'
                : 'text.secondary',
            }}
          />
          <Box
            component="span"
            sx={{
              fontSize: '0.75rem',
              fontWeight: isAvailableOrdersActive ? 600 : 400,
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {t('agent.openOrders.title', 'Available Orders')}
          </Box>
        </Box>

        {/* Active Orders Tab with count badge */}
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
            color: isActiveOrdersActive
              ? 'primary.main'
              : 'text.secondary',
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
          <Badge
            badgeContent={activeOrderCount}
            color="primary"
            max={99}
            invisible={activeOrderCount === 0}
          >
            <Assignment
              sx={{
                fontSize: 24,
                color: isActiveOrdersActive
                  ? 'primary.main'
                  : 'text.secondary',
              }}
            />
          </Badge>
          <Box
            component="span"
            sx={{
              fontSize: '0.75rem',
              fontWeight: isActiveOrdersActive ? 600 : 400,
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {t('agent.activeOrders', 'Active Orders')}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default AgentBottomNav;
