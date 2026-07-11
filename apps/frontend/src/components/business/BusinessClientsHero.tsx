import { Box, Skeleton, Typography } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface BusinessClientsHeroProps {
  count: number | null;
  loading: boolean;
  onClick?: () => void;
}

/**
 * Hero milestone for unique customers (orders ∪ rentals) on the business dashboard.
 */
export function BusinessClientsHero({
  count,
  loading,
  onClick,
}: BusinessClientsHeroProps) {
  const { t } = useTranslation();
  const isUnknown = !loading && count == null;
  const isEmpty = !loading && count === 0;

  return (
    <Box
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={t(
        'business.dashboard.clientsSoFar.a11y',
        'Clients so far. Open city word cloud.'
      )}
      sx={{
        mb: 3,
        p: 2.5,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        cursor: onClick ? 'pointer' : 'default',
        backgroundImage: (theme) =>
          `linear-gradient(135deg, ${theme.palette.primary.main}12 0%, transparent 55%)`,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        '&:hover': onClick
          ? {
              borderColor: 'primary.light',
              boxShadow: 1,
            }
          : undefined,
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
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          flexShrink: 0,
        }}
      >
        <PeopleOutlineRoundedIcon />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
          {t('business.dashboard.clientsSoFar.label', 'Clients so far')}
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
                'business.dashboard.clientsSoFar.unavailableHint',
                'Client count unavailable right now'
              )
            : isEmpty
              ? t(
                  'business.dashboard.clientsSoFar.emptyHint',
                  'Customers who order or rent will show up here.'
                )
              : t(
                  'business.dashboard.clientsSoFar.hintClick',
                  'Tap to see where your clients are coming from'
                )}
        </Typography>
      </Box>
      {onClick ? (
        <ChevronRightRoundedIcon color="action" sx={{ flexShrink: 0 }} />
      ) : null}
    </Box>
  );
}

export default BusinessClientsHero;
