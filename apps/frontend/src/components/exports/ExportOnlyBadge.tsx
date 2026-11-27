import { FlightTakeoff } from '@mui/icons-material';
import { Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const EXPORT_BRAND_BLUE = '#0A4FB5';

interface ExportOnlyBadgeProps {
  /** `overlay` sits on an image (bottom-left); `inline` sits under a title. */
  variant?: 'overlay' | 'inline';
}

/** Plane icon + "Export only" / "Export uniquement" on every export item surface. */
export const ExportOnlyBadge: React.FC<ExportOnlyBadgeProps> = ({ variant = 'inline' }) => {
  const { t } = useTranslation();
  const overlay = variant === 'overlay';
  return (
    <Box
      component="span"
      data-testid="export-only-badge"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        bgcolor: EXPORT_BRAND_BLUE,
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        ...(overlay && {
          position: 'absolute',
          left: 8,
          bottom: 8,
          zIndex: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }),
      }}
    >
      <FlightTakeoff sx={{ fontSize: 14 }} aria-hidden />
      {t('exportItem.badge', 'Export only')}
    </Box>
  );
};

export default ExportOnlyBadge;
