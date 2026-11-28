import { Public } from '@mui/icons-material';
import { Box, Chip, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { exportCountryName } from '../../utils/exportCountries';
import { EXPORT_BRAND_BLUE } from './ExportOnlyBadge';

interface ExportedToBoxProps {
  destinations: string[];
  /** Viewer market; its chip is highlighted when it is a destination. */
  marketCode?: string | null;
}

/** PDP box: destination chips and the "export only, not bought in the app" line. */
export const ExportedToBox: React.FC<ExportedToBoxProps> = ({ destinations, marketCode }) => {
  const { t, i18n } = useTranslation();
  const market = marketCode?.toUpperCase();
  return (
    <Box
      data-testid="exported-to-box"
      sx={{ bgcolor: '#EAF1FB', borderRadius: 2, p: 1.5, my: 1.5 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <Public sx={{ fontSize: 18, color: EXPORT_BRAND_BLUE }} aria-hidden />
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: EXPORT_BRAND_BLUE }}>
          {t('exportItem.exportedTo', 'Exported to')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t(
          'exportItem.soldForExportOnly',
          'This item is sold for export only. It can’t be bought in the app.'
        )}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {destinations.map((code) => {
          const mine = code === market;
          return (
            <Chip
              key={code}
              size="small"
              label={code}
              title={exportCountryName(code, i18n.language)}
              aria-label={
                mine
                  ? `${exportCountryName(code, i18n.language)} · ${t('exportItem.yourMarket', 'Your market')}`
                  : exportCountryName(code, i18n.language)
              }
              sx={{
                fontWeight: 700,
                bgcolor: mine ? EXPORT_BRAND_BLUE : '#fff',
                color: mine ? '#fff' : 'text.primary',
                border: mine ? 'none' : '1px solid #D5DCE6',
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default ExportedToBox;
