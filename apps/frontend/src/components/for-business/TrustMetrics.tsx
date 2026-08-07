import { Container, Skeleton } from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatMarketplaceStat,
  useMarketplacePublicStats,
} from '../../hooks/useMarketplacePublicStats';
import SectionCTA from './SectionCTA';
import StatItem, { StatStrip } from './StatItem';

const TrustMetrics: React.FC = () => {
  const { t } = useTranslation();
  const { stats, loading } = useMarketplacePublicStats();

  const items = useMemo(() => {
    const merchants = stats
      ? formatMarketplaceStat(stats.merchants)
      : t('forBusiness.metrics.merchants.value', '—');
    const products = stats
      ? formatMarketplaceStat(stats.products)
      : t('forBusiness.metrics.products.value', '—');
    const cities = stats
      ? formatMarketplaceStat(stats.cities)
      : t('forBusiness.metrics.cities.value', '—');
    const orders = stats
      ? formatMarketplaceStat(stats.orders)
      : t('forBusiness.metrics.orders.value', '—');
    const setupMax = stats?.setupMinutesMax ?? 5;
    const payments = stats?.securePaymentsPercent ?? 100;

    return [
      {
        value: merchants,
        label: t('forBusiness.metrics.merchants.label', 'Merchants'),
      },
      {
        value: products,
        label: t('forBusiness.metrics.products.label', 'Products listed'),
      },
      {
        value: cities,
        label: t('forBusiness.metrics.cities.label', 'Cities served'),
      },
      {
        value: orders,
        label: t('forBusiness.metrics.orders.label', 'Orders completed'),
      },
      {
        value: t('forBusiness.metrics.setup.value', `<${setupMax} min`),
        label: t('forBusiness.metrics.setup.label', 'Average setup'),
      },
      {
        value: t('forBusiness.metrics.payments.value', `${payments}%`),
        label: t('forBusiness.metrics.payments.label', 'Secure payments'),
      },
    ];
  }, [stats, t]);

  return (
    <Container
      maxWidth="lg"
      sx={{ py: { xs: 4, md: 5 }, mt: { xs: -2, md: -3 }, position: 'relative', zIndex: 2 }}
    >
      <StatStrip>
        {loading && !stats
          ? items.map((s) => (
              <Skeleton
                key={s.label}
                variant="rounded"
                width={120}
                height={72}
                sx={{ m: 1 }}
              />
            ))
          : items.map((s) => (
              <StatItem key={s.label} value={s.value} label={s.label} />
            ))}
      </StatStrip>
      <SectionCTA
        compact
        primaryLabel={t('forBusiness.cta.primary', 'Create my store for free')}
      />
    </Container>
  );
};

export default TrustMetrics;
