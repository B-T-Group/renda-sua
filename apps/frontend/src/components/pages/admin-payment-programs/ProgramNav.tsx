import { Box, Tab, Tabs } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const PRIMARY = [
  { id: 'hub', key: 'admin.paymentPrograms.title', fallback: 'Overview' },
  {
    id: 'schedules',
    key: 'admin.paymentPrograms.schedules',
    fallback: 'Schedules',
  },
  {
    id: 'advances',
    key: 'admin.paymentPrograms.advances',
    fallback: 'Cash advances',
  },
  {
    id: 'credits',
    key: 'admin.paymentPrograms.credits',
    fallback: 'Credits',
  },
  {
    id: 'assignments',
    key: 'admin.paymentPrograms.assignments',
    fallback: 'Assignments',
  },
] as const;

const SUPPORTING = [
  {
    id: 'partners',
    key: 'admin.paymentPrograms.partners',
    fallback: 'Partners',
  },
  {
    id: 'campaigns',
    key: 'admin.paymentPrograms.campaigns',
    fallback: 'Campaigns',
  },
] as const;

const ALL_TABS = [...PRIMARY, ...SUPPORTING] as const;

export function ProgramNav({ section }: { section: string }) {
  const { t } = useTranslation();
  const value = ALL_TABS.some((item) => item.id === section)
    ? section
    : 'hub';

  return (
    <Box
      sx={{
        width: '100%',
        borderBottom: 1,
        borderColor: 'divider',
        mb: 1,
      }}
    >
      <Tabs
        value={value}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label={t('admin.paymentPrograms.title', 'Payment programs')}
      >
        {ALL_TABS.map((item) => (
          <Tab
            key={item.id}
            value={item.id}
            label={t(item.key, item.fallback)}
            component={Link}
            to={
              item.id === 'hub'
                ? '/admin/payment-programs'
                : `/admin/payment-programs/${item.id}`
            }
          />
        ))}
      </Tabs>
    </Box>
  );
}
