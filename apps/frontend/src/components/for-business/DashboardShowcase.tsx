import { Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import MockScreenCard, { type MockScreenKind } from './MockScreenCard';
import SectionCTA from './SectionCTA';
import SectionShell from './SectionShell';

const DashboardShowcase: React.FC = () => {
  const { t } = useTranslation();
  const cards: { kind: MockScreenKind; titleKey: string; def: string }[] = [
    { kind: 'dashboard', titleKey: 'forBusiness.showcase.dashboard', def: 'Dashboard' },
    { kind: 'inventory', titleKey: 'forBusiness.showcase.inventory', def: 'Inventory' },
    { kind: 'orders', titleKey: 'forBusiness.showcase.orders', def: 'Orders' },
    { kind: 'analytics', titleKey: 'forBusiness.showcase.analytics', def: 'Analytics' },
    { kind: 'ai', titleKey: 'forBusiness.showcase.ai', def: 'AI listings' },
  ];

  return (
    <SectionShell
      id="dashboard-showcase"
      title={t('forBusiness.showcase.title', 'Your store, managed in one place')}
      subtitle={t(
        'forBusiness.showcase.subtitle',
        'See sales, stock, orders, and AI tools — built for merchants on mobile and desktop.'
      )}
      bgcolor="background.paper"
    >
      <Box
        sx={{
          display: 'flex',
          gap: 2.5,
          overflowX: 'auto',
          pb: 2,
          px: 0.5,
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          '& > *': { scrollSnapAlign: 'start' },
        }}
      >
        {cards.map((c) => (
          <MockScreenCard key={c.kind} kind={c.kind} title={t(c.titleKey, c.def)} />
        ))}
      </Box>
      <SectionCTA
        primaryLabel={t('forBusiness.cta.primary', 'Create my store for free')}
      />
    </SectionShell>
  );
};

export default DashboardShowcase;
