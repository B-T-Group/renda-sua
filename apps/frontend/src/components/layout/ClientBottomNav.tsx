import { Assignment, EventAvailable, Person, Search, ShoppingBag } from '@mui/icons-material';
import { useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useClientFlags } from '../../hooks/useClientFlags';
import { useClientRentalsTabBadge } from '../../hooks/useClientRentalsTabBadge';
import { useTrackSiteEvent } from '../../hooks/useTrackSiteEvent';
import { myRentalsEntrySegment } from '../../utils/myRentalsTodoCount';
import BottomNavBar, { BottomNavTab } from './BottomNavBar';
import { clientBottomNavModel } from './clientBottomNavModel';

const ClientBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { userType } = useUserProfileContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { flags } = useClientFlags();
  const rentalsTab = flags.rentals_client_tab_enabled;
  const rentalsTodo = useClientRentalsTabBadge(rentalsTab && userType === 'client' && isMobile);
  const { trackSiteEvent } = useTrackSiteEvent();

  if (userType !== 'client' || !isMobile) {
    return null;
  }

  const labels: Record<string, string> = {
    home: t('nav.clientTabs.home', 'Home'),
    search: t('nav.clientTabs.search', 'Search'),
    rentals: t('nav.clientTabs.rentals', 'Rentals'),
    orders: rentalsTab ? t('nav.clientTabs.orders', 'Orders') : t('common.orders', 'Orders'),
    account: t('nav.tabs.account', 'Account'),
  };
  const icons: Record<string, React.ReactNode> = {
    home: <ShoppingBag />,
    search: <Search />,
    rentals: <EventAvailable />,
    orders: <Assignment />,
    account: <Person />,
  };
  const model = clientBottomNavModel({
    rentalsTabEnabled: rentalsTab,
    pathname: location.pathname,
    search: location.search,
  });
  const tabs: BottomNavTab[] = model.map((tab) => ({
    key: tab.key,
    label: labels[tab.key],
    path: tab.path,
    icon: icons[tab.key],
    active: tab.active,
    badge: tab.key === 'rentals' ? rentalsTodo.badge : null,
    onPress:
      tab.key === 'rentals'
        ? () => {
            void trackSiteEvent({
              eventType: 'rentals_client_tab_tap',
              metadata: {
                source: 'tab',
                segment: myRentalsEntrySegment(rentalsTodo.count),
                todo_count: rentalsTodo.count,
              },
            });
          }
        : undefined,
  }));

  return <BottomNavBar tabs={tabs} />;
};

export default ClientBottomNav;
