import { useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useMarket } from '../../hooks/useMarket';
import { useMarketLanes } from '../../hooks/useMarketLanes';
import {
  browseLaneNavItems,
  isBrowseLanePathActive,
} from '../../utils/browseMarketLanes';
import BottomNavBar, { BottomNavTab } from './BottomNavBar';

const GuestBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isAuthenticated } = useSessionAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { selectedMarket } = useMarket();
  const { visible } = useMarketLanes(selectedMarket?.countryCode);

  if (isAuthenticated || !isMobile) {
    return null;
  }

  const tabs: BottomNavTab[] = browseLaneNavItems(visible).map((lane) => ({
    key: lane.key,
    label: t(lane.labelKey, lane.labelDefault),
    path: lane.path,
    icon: lane.icon,
    active: isBrowseLanePathActive(location.pathname, lane.path),
  }));

  if (tabs.length === 0) {
    return null;
  }

  return <BottomNavBar tabs={tabs} />;
};

export default GuestBottomNav;
