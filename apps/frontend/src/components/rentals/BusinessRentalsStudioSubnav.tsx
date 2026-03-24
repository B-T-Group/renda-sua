import { Tab, Tabs } from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

const PATHS = [
  '/business/rentals/catalog',
  '/business/rentals/requests',
  '/business/rentals/schedule',
] as const;

export function rentalStudioTabFromPath(pathname: string): number {
  if (pathname.includes('/business/rentals/schedule')) {
    return 2;
  }
  if (pathname.includes('/business/rentals/requests')) {
    return 1;
  }
  if (pathname.includes('/business/rentals/catalog')) {
    return 0;
  }
  if (pathname.includes('/business/rentals/items/')) {
    return 0;
  }
  return 0;
}

const BusinessRentalsStudioSubnav: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const value = useMemo(() => rentalStudioTabFromPath(pathname), [pathname]);

  return (
    <Tabs
      value={value}
      onChange={(_, v: number) => navigate(PATHS[v])}
      variant="scrollable"
      scrollButtons="auto"
      sx={{
        minHeight: 44,
        borderBottom: 1,
        borderColor: 'divider',
        px: { xs: 0.5, sm: 1 },
        '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 600 },
      }}
    >
      <Tab label={t('business.rentals.catalogTab', 'Catalog')} />
      <Tab label={t('business.rentals.requestsTab', 'Requests')} />
      <Tab label={t('business.rentals.myScheduleTab', 'MySchedule')} />
    </Tabs>
  );
};

export default BusinessRentalsStudioSubnav;
