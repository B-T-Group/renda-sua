import {
  Assignment,
  CarRental,
  RestaurantMenu,
  ShoppingBag,
} from '@mui/icons-material';
import { useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import BottomNavBar, { BottomNavTab } from './BottomNavBar';

const ClientBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { userType } = useUserProfileContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Only show for clients on mobile
  if (userType !== 'client' || !isMobile) {
    return null;
  }

  const isOrdersActive =
    location.pathname === '/orders' ||
    (location.pathname.startsWith('/orders/') &&
      !location.pathname.startsWith('/orders/batch') &&
      !location.pathname.startsWith('/orders/confirmation'));

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
      label: t('rentals.title', 'Rentals'),
      path: '/rentals',
      icon: <CarRental />,
      active: location.pathname.startsWith('/rentals'),
    },
    {
      key: 'foods',
      label: t('foods.title', 'Food'),
      path: '/foods',
      icon: <RestaurantMenu />,
      active: location.pathname.startsWith('/foods'),
    },
    {
      key: 'orders',
      label: t('common.orders', 'Orders'),
      path: '/orders',
      icon: <Assignment />,
      active: isOrdersActive,
    },
  ];

  return <BottomNavBar tabs={tabs} />;
};

export default ClientBottomNav;
