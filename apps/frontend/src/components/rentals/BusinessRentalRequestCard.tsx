import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { BusinessRentalRequestRow } from '../../hooks/useRentalApi';
import {
  formatRequestAmount,
  parseRentalPricingSnapshot,
} from '../../utils/rentalRequestDisplay';
import {
  computeRentalPricingLines,
  parseRentalSelectionWindowsFromJson,
} from '../../utils/rentalPricingLines';
import { resolveRentalPhase } from '../../utils/rentalPhase';
import { expiredRequestWindow, isExpiredRentalRequest, requestPhotoUrl } from '../../utils/dashboardRentalRequests';
import { buildRequestCardModel } from '../../utils/rentalRequestCardModel';
import { RentalRequestExpiredBanner } from '../business/RentalRequestExpiredBanner';

function changeDetail(summary: BusinessRentalRequestRow['change_summary']): string {
  if (!summary?.fields?.length) return '';
  const bits: string[] = [];
  if (summary.fields.includes('dates') && summary.dates) {
    bits.push(`dates ${exclusiveRange(summary.dates.from)} → ${exclusiveRange(summary.dates.to)}`);
  }
  if (summary.fields.includes('quantity') && summary.quantity) {
    bits.push(`quantity ${summary.quantity.from} → ${summary.quantity.to}`);
  }
  if (summary.fields.includes('notes')) bits.push('notes');
  return bits.join(', ');
}


function finiteQuotedTotal(value: unknown): number | null {
  if (value == null || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function exclusiveRange(windows: Array<{ calendar_date?: string }> | undefined): string {
  const days = (windows ?? []).map((row) => row.calendar_date).filter((day): day is string => Boolean(day)).sort();
  if (!days.length) return '';
  const end = new Date(`${days[days.length - 1]}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const month = end.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' });
  return `${Number(days[0].slice(8))}–${end.getUTCDate()} ${month}`;
}

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
  const { t, i18n } = useTranslation();
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
  const imgUrl = requestPhotoUrl(request);
  const imgAlt = itemName;
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const model = buildRequestCardModel(request, i18n.language, new Date(), t);
  const currency = request.rental_location_listing?.rental_item?.currency ?? 'XAF';
  const pricingPreview = useMemo(() => {
    const quoted = parseRentalPricingSnapshot(request.rental_pricing_snapshot);
    const frozen = finiteQuotedTotal(request.quoted_total) ?? quoted?.total ?? null;
    if (quoted?.lines?.length) {
      return { lines: quoted.lines, total: frozen ?? quoted.total, currency: quoted.currency };
    }
    const windows = parseRentalSelectionWindowsFromJson(request.rental_selection_windows);
    if (!windows.length) {
      return { lines: [], total: frozen ?? 0, currency: quoted?.currency ?? currency };
    }
    const ratePerHour = Number(request.rental_location_listing.base_price_per_hour);
    const ratePerDay = Number(request.rental_location_listing.base_price_per_day ?? 0);
    const units = Math.max(1, Math.floor(Number(request.units_requested)) || 1);
    const computed = computeRentalPricingLines(windows, ratePerHour, ratePerDay, units);
    return { lines: computed.lines, total: frozen ?? computed.total, currency: quoted?.currency ?? currency };
  }, [
    currency,
    request.quoted_total,
    request.rental_location_listing.base_price_per_day,
    request.rental_location_listing.base_price_per_hour,
    request.rental_pricing_snapshot,
    request.rental_selection_windows,
    request.units_requested,
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

  const openBooking = () => {
    if (!booking?.id) return;
    navigate(`/rentals/bookings/${booking.id}`);
  };

  const stopAnd = (fn: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    fn();
  };

  const cardOpensBooking = Boolean(booking?.id);

  return (
    <Paper
      elevation={0}
      data-testid="rental-request-row"
      role={cardOpensBooking ? 'button' : undefined}
      tabIndex={cardOpensBooking ? 0 : undefined}
      aria-label={
        cardOpensBooking
          ? t('business.rentals.openRequestCardA11y', 'Open {{item}}, {{status}}', {
              item: itemName,
              status: isExpiredRentalRequest(request)
                ? t('rentals.requestCard.expired', 'Expired')
                : request.status === 'pending'
                  ? t('rentals.modify.requested', 'Requested')
                  : t(phase.labelKey, request.status),
            })
          : undefined
      }
      onClick={cardOpensBooking ? openBooking : undefined}
      onKeyDown={
        cardOpensBooking
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openBooking();
              }
            }
          : undefined
      }
      sx={{
        border: 1,
        borderColor: 'divider',
        p: { xs: 2, sm: 2.5 },
        mb: 2.25,
        borderRadius: 2,
        bgcolor: 'background.paper',
        ...(cardOpensBooking
          ? {
              cursor: 'pointer',
              '&:hover': { borderColor: 'primary.light' },
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 2,
              },
            }
          : {}),
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
          <Box
            aria-hidden
            sx={{
              width: 104,
              height: 104,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              flexShrink: 0,
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ItemCategoryIcon request={request} />
          </Box>
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
            <Stack direction="row" spacing={0.5}>
              <Chip
                size="small"
                data-testid={isExpiredRentalRequest(request) ? 'rental-request-expired-chip' : undefined}
                color={isExpiredRentalRequest(request) ? 'default' : statusChipColor}
                label={
                  isExpiredRentalRequest(request)
                    ? t('rentals.requestCard.expired', 'Expired')
                    : request.status === 'pending'
                      ? t('rentals.modify.requested', 'Requested')
                      : t(phase.labelKey, request.status)
                }
                sx={{
                  fontWeight: 800,
                  ...(isExpiredRentalRequest(request)
                    ? { bgcolor: 'action.hover', color: 'text.secondary' }
                    : {}),
                }}
              />
              {(request.change_summary?.fields?.length ?? 0) > 0 ? (
                <Chip size="small" color="primary" variant="outlined" label={t('rentals.modify.updated', 'Updated')} />
              ) : null}
            </Stack>
          </Stack>
          {isExpiredRentalRequest(request) ? (
            <RentalRequestExpiredBanner window={expiredRequestWindow(request)} />
          ) : null}

          {(request.change_summary?.fields?.length ?? 0) > 0 ? (
            <Typography variant="body2" color="primary.main">
              {t('rentals.modify.changed', 'Changed: {{detail}}', {
                detail: changeDetail(request.change_summary),
              })}
            </Typography>
          ) : null}

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
            {model.schedule.summary || '—'}
          </Typography>

          <Typography
            variant="body2"
            fontWeight={700}
            color={isExpiredRentalRequest(request) ? 'text.secondary' : 'text.primary'}
          >
            {isExpiredRentalRequest(request)
              ? t('rentals.requestCard.wouldHaveReceived', 'Would have received {{amount}}', {
                  amount: formatRequestAmount(
                    pricingPreview.total,
                    pricingPreview.currency,
                    i18n.language
                  ),
                })
              : formatRequestAmount(pricingPreview.total, pricingPreview.currency, i18n.language)}
          </Typography>

          <Stack
            direction="row"
            spacing={1}
            sx={{ pt: 0.25, flexWrap: 'wrap', justifyContent: 'flex-end' }}
          >
            {request.status === 'pending' ? (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  data-testid="rental-request-decline"
                  onClick={stopAnd(() => onReject(request))}
                >
                  {t('rentals.actions.decline', 'Decline')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  data-testid="rental-request-accept"
                  onClick={stopAnd(() => onAccept(request))}
                >
                  {t('rentals.actions.accept', 'Accept')}
                </Button>
              </>
            ) : null}

            {openBookingCta && booking?.id ? (
              <Button size="small" variant="contained" onClick={stopAnd(openBooking)}>
                {phase.businessQueue === 'return'
                  ? t('rentals.actions.confirmReturn', 'Confirm return')
                  : t('rentals.actions.openBooking', 'Open booking')}
              </Button>
            ) : booking?.id ? (
              <Button size="small" variant="outlined" onClick={stopAnd(openBooking)}>
                {t('rentals.actions.openBooking', 'Open booking')}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
};

function ItemCategoryIcon({ request }: { request: BusinessRentalRequestRow }) {
  const name =
    request.rental_location_listing.rental_item.rental_category?.name ||
    request.rental_location_listing.rental_item.name;
  const Icon = categoryIcon(name);
  return <Icon color="action" sx={{ fontSize: 40 }} />;
}

function categoryIcon(name: string) {
  if (/camera|photo|caméra|appareil/i.test(name)) return PhotoCameraOutlinedIcon;
  if (/equipment|équipement|equipement|tool|outil|light/i.test(name)) return HandymanOutlinedIcon;
  if (/power|électr|electr|éclair/i.test(name)) return BoltOutlinedIcon;
  return CategoryOutlinedIcon;
}

