import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Box, Skeleton, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface BusinessViewsHeroProps {
  count: number | null;
  viewsLast7d: number | null;
  loading: boolean;
}

/**
 * Hero milestone for unique product viewers on the business dashboard.
 */
export function BusinessViewsHero({
  count,
  viewsLast7d,
  loading,
}: BusinessViewsHeroProps) {
  const { t } = useTranslation();
  const isUnknown = !loading && count == null;
  const isEmpty = !loading && count === 0;
  const showWeekDelta =
    !loading && typeof viewsLast7d === 'number' && viewsLast7d > 0;

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: '100%',
        backgroundImage: (theme) =>
          `linear-gradient(135deg, ${theme.palette.secondary.main}12 0%, transparent 55%)`,
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'secondary.main',
          color: 'secondary.contrastText',
          flexShrink: 0,
        }}
      >
        <VisibilityOutlinedIcon />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
          {t('business.dashboard.productViews.label', 'Product views')}
        </Typography>
        {loading ? (
          <Skeleton variant="text" width={72} height={40} />
        ) : (
          <Typography
            variant="h3"
            component="p"
            sx={{ fontWeight: 700, lineHeight: 1.1, my: 0.25 }}
          >
            {isUnknown ? '—' : (count as number).toLocaleString()}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          {isUnknown
            ? t(
                'business.dashboard.productViews.unavailableHint',
                'Views unavailable right now'
              )
            : isEmpty
              ? t(
                  'business.dashboard.productViews.emptyHint',
                  'Share your store so people can discover your products.'
                )
              : showWeekDelta
                ? t('business.dashboard.productViews.weekDelta', '+{{count}} this week', {
                    count: viewsLast7d,
                  })
                : t(
                    'business.dashboard.productViews.hint',
                    'People who viewed your products'
                  )}
        </Typography>
      </Box>
    </Box>
  );
}

export default BusinessViewsHero;
