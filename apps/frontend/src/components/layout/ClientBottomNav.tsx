import { Assignment, Person, Search, ShoppingBag } from '@mui/icons-material';
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
      key: 'home',
      label: t('nav.clientTabs.home', 'Home'),
      path: '/items',
      icon: <ShoppingBag />,
      active:
        location.pathname === '/items' ||
        location.pathname.startsWith('/items/') ||
        location.pathname.startsWith('/foods') ||
        location.pathname.startsWith('/rentals'),
    },
    {
      key: 'search',
      label: t('nav.clientTabs.search', 'Search'),
      path: '/items?focus=search',
      icon: <Search />,
      active: location.search.includes('focus=search'),
    },
    {
      key: 'orders',
      label: t('common.orders', 'Orders'),
      path: '/orders',
      icon: <Assignment />,
      active: isOrdersActive,
    },
    {
      key: 'account',
      label: t('nav.tabs.account', 'Account'),
      path: '/profile',
      icon: <Person />,
      active: location.pathname.startsWith('/profile'),
    },
  ];

  return <BottomNavBar tabs={tabs} />;
};

export default ClientBottomNav;
