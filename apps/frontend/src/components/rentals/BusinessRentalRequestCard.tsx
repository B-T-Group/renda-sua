import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { BusinessRentalRequestRow } from '../../hooks/useRentalApi';
import {
  formatRentalMoney,
  parseRentalPricingSnapshot,
  parseRentalSelectionWindows,
} from '../../utils/rentalRequestDisplay';
import {
  computeRentalPricingLines,
  parseRentalSelectionWindowsFromJson,
} from '../../utils/rentalPricingLines';
import { resolveRentalPhase } from '../../utils/rentalPhase';

function formatDateTimeWithoutTimezone(value?: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value?: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export interface BusinessRentalRequestCardProps {
  request: BusinessRentalRequestRow;
  onAccept: (request: BusinessRentalRequestRow) => void;
  onReject: (request: BusinessRentalRequestRow) => void;
}

export const BusinessRentalRequestCard: React.FC<BusinessRentalRequestCardProps> = ({
  request,
  onAccept,
  onReject,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const firstName = request.client?.user?.first_name?.trim() || '';
  const lastName = request.client?.user?.last_name?.trim() || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const email = request.client?.user?.email?.trim() || '';
  const phone = request.client?.user?.phone_number?.trim() || '';
  const booking = request.rental_booking ?? null;
  const bookingIsActive = booking?.status === 'active';
  const actualStartAt = booking?.actual_start_at ?? null;
  const itemName = request.rental_location_listing?.rental_item?.name ?? '—';
  const img = request.rental_location_listing?.rental_item?.rental_item_images?.[0];
  const imgUrl =
    (img?.image_url?.trim() ||
      (img as { imageUrl?: string | null } | undefined)?.imageUrl?.trim() ||
      '') as string;
  const imgAlt = img?.alt_text?.trim() || itemName;
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const selectionWindows = useMemo(
    () => parseRentalSelectionWindows(request.rental_selection_windows),
    [request.rental_selection_windows]
  );
  const currency = request.rental_location_listing?.rental_item?.currency ?? 'XAF';
  const pricingPreview = useMemo(() => {
    const quoted = parseRentalPricingSnapshot(request.rental_pricing_snapshot);
    if (quoted?.lines?.length) {
      return { lines: quoted.lines, total: quoted.total, currency: quoted.currency };
    }
    const windows = parseRentalSelectionWindowsFromJson(request.rental_selection_windows);
    if (!windows.length) {
      return { lines: [], total: 0, currency };
    }
    const ratePerHour = Number(request.rental_location_listing.base_price_per_hour);
    const ratePerDay = Number(request.rental_location_listing.base_price_per_day ?? 0);
    const computed = computeRentalPricingLines(windows, ratePerHour, ratePerDay);
    return { lines: computed.lines, total: computed.total, currency };
  }, [
    currency,
    request.rental_location_listing.base_price_per_day,
    request.rental_location_listing.base_price_per_hour,
    request.rental_pricing_snapshot,
    request.rental_selection_windows,
  ]);

  const phase = useMemo(
    () =>
      resolveRentalPhase(
        {
          requestStatus: request.status,
          bookingStatus: booking?.status ?? null,
        },
        'business'
      ),
    [booking?.status, request.status]
  );

  const statusChipColor = useMemo(() => {
    if (phase.phase === 'in_progress') return 'success' as const;
    if (phase.phase === 'requested') return 'warning' as const;
    if (phase.phase === 'offer_ready' || phase.phase === 'ready_for_pickup') {
      return 'success' as const;
    }
    if (phase.phase === 'reserved') return 'info' as const;
    if (request.status === 'unavailable') return 'error' as const;
    return 'default' as const;
  }, [phase.phase, request.status]);

  const openBookingCta =
    !!booking?.id &&
    (phase.businessQueue === 'collect_pay' ||
      phase.businessQueue === 'start' ||
      phase.businessQueue === 'return');

  return (
    <Paper
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        p: { xs: 2, sm: 2.5 },
        mb: 2.25,
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={2} alignItems="stretch">
        {imgUrl && !imageLoadFailed ? (
          <Box
            component="img"
            src={imgUrl}
            alt={imgAlt}
            onError={() => setImageLoadFailed(true)}
            sx={{
              width: 104,
              height: 104,
              borderRadius: 2,
              objectFit: 'cover',
              border: 1,
              borderColor: 'divider',
              flexShrink: 0,
              bgcolor: 'action.hover',
            }}
          />
        ) : (
          <Avatar
            variant="rounded"
            sx={{
              width: 104,
              height: 104,
              borderRadius: 2,
              fontWeight: 900,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: 'primary.main',
              border: 1,
              borderColor: 'divider',
              flexShrink: 0,
              fontSize: '1.1rem',
            }}
          >
            {itemName?.trim()?.[0]?.toUpperCase() ?? 'R'}
          </Avatar>
        )}

        <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-start"
            justifyContent="space-between"
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={900} noWrap>
                {itemName}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {fullName || email || phone || '—'}
              </Typography>
            </Box>
            <Chip
              size="small"
              color={statusChipColor}
              label={t(phase.labelKey, request.status)}
              sx={{ fontWeight: 800 }}
            />
          </Stack>

          {bookingIsActive && actualStartAt ? (
            <Alert severity="success" sx={{ py: 0.5 }}>
              {t('rentals.inProgress', 'In progress')} —{' '}
              {formatDateTimeWithoutTimezone(actualStartAt)}
            </Alert>
          ) : null}

          {phase.nextStepKey ? (
            <Typography variant="body2" color="text.secondary">
              {t(phase.nextStepKey, '')}
            </Typography>
          ) : null}

          <Typography variant="body2" color="text.secondary">
            {selectionWindows.length
              ? selectionWindows
                  .map((w) =>
                    w.billing === 'all_day'
                      ? formatDateOnly(w.start_at)
                      : `${formatDateTimeWithoutTimezone(w.start_at)} → ${formatDateTimeWithoutTimezone(w.end_at)}`
                  )
                  .join(' · ')
              : '—'}
          </Typography>

          <Typography variant="body2" fontWeight={700}>
            {formatRentalMoney(pricingPreview.total, pricingPreview.currency)}
          </Typography>

          <Stack
            direction="row"
            spacing={1}
            sx={{ pt: 0.25, flexWrap: 'wrap', justifyContent: 'flex-end' }}
          >
            {request.status === 'pending' ? (
              <>
                <Button size="small" variant="contained" onClick={() => onAccept(request)}>
                  {t('rentals.actions.accept', 'Accept')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={() => onReject(request)}
                >
                  {t('rentals.actions.decline', 'Decline')}
                </Button>
              </>
            ) : null}

            {openBookingCta && booking?.id ? (
              <Button
                size="small"
                variant="contained"
                onClick={() => navigate(`/rentals/bookings/${booking.id}`)}
              >
                {phase.businessQueue === 'collect_pay'
                  ? t('rentals.actions.collectPayment', 'Collect payment')
                  : phase.businessQueue === 'start'
                    ? t('rentals.actions.verifyStartPin', 'Verify start PIN')
                    : phase.businessQueue === 'return'
                      ? t('rentals.actions.confirmReturn', 'Confirm return')
                      : t('rentals.actions.openBooking', 'Open booking')}
              </Button>
            ) : booking?.id ? (
              <Button
                size="small"
                variant="outlined"
                onClick={() => navigate(`/rentals/bookings/${booking.id}`)}
              >
                {t('rentals.actions.openBooking', 'Open booking')}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
};
