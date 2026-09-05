import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import {
  LocalShipping as DeliveryIcon,
  LocationOn as LocationIcon,
  Schedule as ClockIcon,
  VerifiedUser as ShieldCheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import type {
  DeliveryCategory,
  DeliveryEstimate,
  ServingStatus,
} from '../../utils/deliveryEstimateAdapter';
import {
  SITE_EVENT_DELIVERY_CARD_VIEW,
  SITE_EVENT_DELIVERY_CARD_AREA_PROMPT_CLICK,
  SITE_EVENT_DELIVERY_CARD_ESTIMATE_READY,
  SITE_EVENT_SUBJECT_INVENTORY_ITEM,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';

export interface DeliveryExpectationsCardProps {
  category: DeliveryCategory;
  market: string;
  area: string | null;
  estimate: DeliveryEstimate | null;
  loading?: boolean;
  itemId?: string;
  onAreaChange?: () => void;
}

function formatFeeRange(
  min: number | null,
  max: number | null,
  currency: string,
  t: (key: string, fallback: string, vars?: Record<string, unknown>) => string
): string {
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency === 'XAF' || currency === 'NGN' ? currency : 'XAF',
    maximumFractionDigits: 0,
  });

  if (min != null && max != null && min !== max) {
    return t(
      'delivery.feeRange',
      '{{min}}–{{max}}',
      { min: formatter.format(min), max: formatter.format(max) }
    );
  }
  if (min != null) {
    return formatter.format(min);
  }
  if (max != null) {
    return formatter.format(max);
  }
  return t('delivery.feeDependsOnDistance', 'Fee depends on distance');
}

function getFoodStatusLabel(
  status: ServingStatus,
  t: (key: string, fallback: string) => string
): string {
  if (status === 'sold_out') {
    return t('delivery.soldOutToday', 'Sold out today');
  }
  if (status === 'closed') {
    return t('delivery.notServingNow', 'Not serving now');
  }
  return '';
}

function getFoodNextOpenLabel(
  t: (key: string, fallback: string, vars?: Record<string, unknown>) => string
): string {
  return t('delivery.nextOpen', 'Next open: {{time}}', { time: 'Mon 08:00–20:00' });
}

export const DeliveryExpectationsCard: React.FC<DeliveryExpectationsCardProps> = ({
  category,
  market,
  area,
  estimate,
  loading = false,
  itemId,
  onAreaChange,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { trackSiteEvent } = useTrackSiteEvent();
  const trackedViewRef = useRef(false);
  const trackedReadyRef = useRef(false);

  useEffect(() => {
    if (!loading && !trackedViewRef.current && itemId) {
      trackedViewRef.current = true;
      void trackSiteEvent({
        eventType: SITE_EVENT_DELIVERY_CARD_VIEW,
        subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
        subjectId: itemId,
        metadata: { category, market, area },
      });
    }
  }, [loading, itemId, category, market, area, trackSiteEvent]);

  useEffect(() => {
    if (
      !loading &&
      estimate &&
      !estimate.needsFinerArea &&
      !trackedReadyRef.current &&
      itemId
    ) {
      trackedReadyRef.current = true;
      void trackSiteEvent({
        eventType: SITE_EVENT_DELIVERY_CARD_ESTIMATE_READY,
        subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
        subjectId: itemId,
        metadata: {
          category,
          market,
          area,
          hasWindow: estimate.window != null,
          hasFee: estimate.fee != null,
        },
      });
    }
  }, [loading, estimate, itemId, category, market, area, trackSiteEvent]);

  const handleAreaPromptClick = () => {
    if (onAreaChange) {
      if (itemId) {
        void trackSiteEvent({
          eventType: SITE_EVENT_DELIVERY_CARD_AREA_PROMPT_CLICK,
          subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
          subjectId: itemId,
          metadata: { category, market },
        });
      }
      onAreaChange();
    }
  };

  if (loading) {
    return (
      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          borderColor: 'divider',
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack spacing={1.5}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="80%" height={20} />
            <Skeleton variant="text" width="70%" height={20} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (!estimate) {
    return null;
  }

  const isFoodClosed = category === 'food' && estimate.servingStatus !== 'available';
  const needsArea = estimate.needsFinerArea;
  const marketLabel = market.toUpperCase() === 'CM' ? 'Cameroon' : market;

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderColor: needsArea || isFoodClosed ? 'warning.main' : 'divider',
        borderWidth: needsArea || isFoodClosed ? 2 : 1,
        bgcolor: needsArea || isFoodClosed ? alpha(theme.palette.warning.main, 0.04) : 'background.paper',
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={1.5}>
          {isFoodClosed ? (
            <Alert
              severity="warning"
              icon={<WarningIcon />}
              sx={{ py: 0.5 }}
            >
              <Typography variant="body2" fontWeight={600}>
                {getFoodStatusLabel(estimate.servingStatus, t)}
              </Typography>
              {estimate.servingStatus === 'closed' && (
                <Typography variant="caption" color="text.secondary">
                  {getFoodNextOpenLabel(t)}
                </Typography>
              )}
            </Alert>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationIcon
                    fontSize="small"
                    sx={{ color: needsArea ? 'warning.main' : 'primary.main' }}
                  />
                  <Typography variant="body2" fontWeight={600}>
                    {t('delivery.deliveringTo', 'Delivering to {{market}} · {{area}}', {
                      market: marketLabel,
                      area: estimate.areaLabel,
                    })}
                  </Typography>
                </Box>
                {onAreaChange && (
                  <Button
                    size="small"
                    onClick={handleAreaPromptClick}
                    sx={{
                      textTransform: 'none',
                      minWidth: 'auto',
                      color: 'primary.main',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                    }}
                  >
                    {t('delivery.change', 'Change')}
                  </Button>
                )}
              </Box>

              {needsArea && (
                <Alert
                  severity="info"
                  icon={<WarningIcon />}
                  sx={{ py: 0.5 }}
                  action={
                    onAreaChange && (
                      <Button
                        size="small"
                        onClick={handleAreaPromptClick}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        {t('delivery.chooseCity', 'Choose city')}
                      </Button>
                    )
                  }
                >
                  <Typography variant="body2">
                    {t('delivery.pickCityPrompt', 'Pick a city for a tighter ETA and fee')}
                  </Typography>
                </Alert>
              )}

              {!needsArea && estimate.window && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ClockIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {estimate.window.label}
                  </Typography>
                </Box>
              )}

              {!needsArea && estimate.fee && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DeliveryIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {t('delivery.deliveryFee', 'Delivery {{fee}} for this area', {
                      fee: formatFeeRange(
                        estimate.fee.min,
                        estimate.fee.max,
                        estimate.fee.currency,
                        t
                      ),
                    })}
                  </Typography>
                </Box>
              )}

              {needsArea && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DeliveryIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {t('delivery.feeBasedOnDistance', 'Fee depends on distance')}
                  </Typography>
                </Box>
              )}

              {!needsArea && estimate.trustVariant === 'map_pin' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShieldCheckIcon fontSize="small" sx={{ color: 'success.main' }} />
                  <Typography variant="caption" color="text.secondary">
                    {t('delivery.trackWithPin', 'Live map tracking + delivery PIN after you order')}
                  </Typography>
                </Box>
              )}

              {!needsArea && estimate.trustVariant === 'standard' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShieldCheckIcon fontSize="small" sx={{ color: 'success.main' }} />
                  <Typography variant="caption" color="text.secondary">
                    {t('delivery.trackStandard', 'Track your order in the app')}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
