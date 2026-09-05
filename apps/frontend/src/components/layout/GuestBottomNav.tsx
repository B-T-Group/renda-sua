import { Handshake, RestaurantMenu, ShoppingBag } from '@mui/icons-material';
import { useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import BottomNavBar, { BottomNavTab } from './BottomNavBar';

const GuestBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isAuthenticated } = useAuth0();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Only show for unauthenticated users on mobile
  if (isAuthenticated || !isMobile) {
    return null;
  }

  const tabs: BottomNavTab[] = [
    {
      key: 'items',
      label: t('common.browseItems', 'Browse Items'),
      path: '/items',
      icon: <ShoppingBag />,
      active:
        location.pathname === '/items' ||
        location.pathname.startsWith('/items/'),
    },
    {
      key: 'rentals',
      label: t('nav.rentals', 'Rentals'),
      path: '/rentals',
      icon: <Handshake />,
      active:
        location.pathname === '/rentals' ||
        location.pathname.startsWith('/rentals/'),
    },
    {
      key: 'foods',
      label: t('foods.title', 'Food'),
      path: '/foods',
      icon: <RestaurantMenu />,
      active: location.pathname.startsWith('/foods'),
    },
  ];

  return <BottomNavBar tabs={tabs} />;
};

export default GuestBottomNav;
