import { Box, Skeleton, alpha } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketplacePublicStats } from '../../hooks/useMarketplacePublicStats';
import SectionShell from './SectionShell';
import { FB_ACCENT } from './forBusinessTheme';

const MerchantLogos: React.FC = () => {
  const { t } = useTranslation();
  const { stats, loading } = useMarketplacePublicStats();
  const logos = stats?.logos ?? [];

  if (!loading && logos.length === 0) {
    return null;
  }

  return (
    <SectionShell
      title={t('forBusiness.logos.title', 'Trusted by local businesses')}
      subtitle={t(
        'forBusiness.logos.subtitle',
        'Merchants across cities already sell with Rendasua.'
      )}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        {loading && logos.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                variant="rounded"
                width={120}
                height={72}
                sx={{ borderRadius: 2 }}
              />
            ))
          : logos.map((logo) => (
              <Box
                key={logo.id}
                sx={{
                  width: 120,
                  height: 72,
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  border: '1.5px solid',
                  borderColor: 'divider',
                  bgcolor: alpha(FB_ACCENT, 0.03),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Box
                  component="img"
                  src={logo.logoUrl}
                  alt={logo.name}
                  loading="lazy"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />
              </Box>
            ))}
      </Box>
    </SectionShell>
  );
};

export default MerchantLogos;
