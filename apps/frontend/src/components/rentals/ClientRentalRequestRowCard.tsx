import { CalendarMonth, LocationOn } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { SITE_EVENT_ASSISTANT_RENTAL_PRICE_CHANGED, useTrackSiteEvent } from '../../hooks/useTrackSiteEvent';
import { priceChangeMeta } from '../../utils/rentalAssistantAttribution';
import { useClientFlags } from '../../hooks/useClientFlags';
import { listReturnChip } from '../../utils/renterReturnPhase';
import type { ClientRentalRequestRow } from '../../hooks/useRentalApi';
import {
  formatRentalMoney,
  formatRentalRequestLocalDateTime,
  parseRentalSelectionWindows,
  parseRentalPricingSnapshot,
  proposedContractDeadlineIso,
} from '../../utils/rentalRequestDisplay';
import { resolveRentalPhase } from '../../utils/rentalPhase';
import { clientRequestPeriodLines } from '../../utils/rentalRequestFormat';

function phaseChipColor(
  phase: string
): 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info' {
  switch (phase) {
    case 'requested':
    case 'reserved':
      return 'warning';
    case 'offer_ready':
    case 'ready_for_pickup':
    case 'in_progress':
      return 'success';
    case 'done':
      return 'default';
    default:
      return 'default';
  }
}

function RequestedPeriodLines({ lines, emptyLabel }: { lines: string[]; emptyLabel: string }) {
  if (!lines.length) {
    return (
      <Typography variant="body2" fontWeight={500}>
        {emptyLabel}
      </Typography>
    );
  }
  return (
    <>
      {lines.map((line, index) => (
        <Typography key={`${index}-${line}`} variant="body2" fontWeight={500} display="block">
          {line}
        </Typography>
      ))}
    </>
  );
}

export function isProposedContractOpen(row: ClientRentalRequestRow): boolean {
  if (row.status !== 'available') return false;
  const b = row.rental_booking;
  if (!b || b.status !== 'proposed') return true;
  const exp = b.contract_expires_at;
  if (!exp) return true;
  return new Date(exp) > new Date();
}

export interface ClientRentalRequestRowCardProps {
  row: ClientRentalRequestRow;
  bookingLoading: boolean;
  /** Opens booking confirmation (parent validates expiry). */
  onBookRequest: (id: string) => void;
  onCancel: (id: string) => void;
  onViewListing: (listingId: string) => void;
  onViewBooking: (bookingId: string) => void;
}

export const ClientRentalRequestRowCard: React.FC<ClientRentalRequestRowCardProps> = ({
  row,
  bookingLoading,
  onBookRequest,
  onCancel,
  onViewListing,
  onViewBooking,
}) => {
  const { t, i18n } = useTranslation();
  const { flags } = useClientFlags();
  const api = useApiClient();
  const { trackSiteEvent } = useTrackSiteEvent();
  const theme = useTheme();
  const listing = row.rental_location_listing;
  const itemName = listing?.rental_item?.name ?? t('rentals.clientRequests.unknownItem', 'Rental');
  const locName = listing?.business_location?.name;
  const quote = parseRentalPricingSnapshot(row.rental_pricing_snapshot);
  const quoted = Number(row.quoted_total);
  const accepted = Number(quote?.total);
  const priceChanged = Number.isFinite(quoted) && Number.isFinite(accepted) && Math.abs(quoted - accepted) >= 0.01;
  useEffect(() => {
    if (!priceChanged) return;
    void trackSiteEvent({
      eventType: SITE_EVENT_ASSISTANT_RENTAL_PRICE_CHANGED,
      metadata: { listing_id: listing?.id, ...priceChangeMeta(quoted, accepted) },
    });
    if (row.price_change_seen_at) return;
    void api.post(`/rentals/requests/${row.id}/price-change-seen`, {}).catch(() => undefined);
  }, [accepted, api, listing?.id, priceChanged, quoted, row.id, row.price_change_seen_at, trackSiteEvent]);
  const phase = resolveRentalPhase(
    {
      requestStatus: row.status,
      bookingStatus: row.rental_booking?.status ?? null,
    },
    'client'
  );
  const statusLabel = t(phase.labelKey, row.status);
  const deadlineIso = proposedContractDeadlineIso(row);
  const canBookNow = row.status === 'available' && isProposedContractOpen(row);
  const reasonCode = row.unavailable_reason_code?.trim();
  const bookingId = row.rental_booking?.id;
  const selectionWindows = parseRentalSelectionWindows(row.rental_selection_windows);
  const periodLines = clientRequestPeriodLines(selectionWindows, i18n.language, (count) =>
    t('rentals.clientRequests.periodDayCount', {
      count,
      defaultValue: count === 1 ? '{{count}} day' : '{{count}} days',
    })
  );

  return (
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ fontSize: '1.05rem' }}>
              {itemName}
            </Typography>
            {locName ? (
              <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.25 }}>
                <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" noWrap>
                  {locName}
                </Typography>
              </Stack>
            ) : null}
          </Box>
          <Stack direction="row" spacing={0.5}>
          <Chip
            label={statusLabel}
            color={phaseChipColor(phase.phase)}
            size="small"
            sx={{ fontWeight: 600, flexShrink: 0 }}
          />
          {flags.rentals_renter_return_report_enabled && row.rental_booking
            ? (() => {
                const chip = listReturnChip({
                  status: row.rental_booking.status,
                  endAt: row.rental_booking.end_at,
                  reportedAt: row.rental_booking.renter_reported_returned_at,
                  escalatedAt: row.rental_booking.renter_return_escalated_at,
                });
                if (!chip) return null;
                const overdue = chip === 'overdue';
                return (
                  <Chip
                    size="small"
                    label={t(
                      overdue ? 'rentals.returnReport.overdue' : 'rentals.returnReport.waitingChip',
                      overdue ? 'Overdue' : 'Waiting'
                    )}
                    sx={{ color: overdue ? 'error.main' : '#0A4FB5', borderColor: overdue ? 'error.main' : '#0A4FB5' }}
                    variant="outlined"
                  />
                );
              })()
            : null}
          </Stack>
        </Stack>

        {phase.nextStepKey ? (
          <Typography variant="body2" color="text.secondary">
            {t(phase.nextStepKey, '')}
          </Typography>
        ) : null}

        <Stack direction="row" alignItems="flex-start" gap={1}>
          <CalendarMonth sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }} />
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('rentals.clientRequests.requestedPeriod', 'Requested period')}
            </Typography>
            <RequestedPeriodLines
              lines={periodLines}
              emptyLabel={t('rentals.clientRequests.unknownPeriod', 'Requested period unavailable')}
            />
          </Box>
        </Stack>

        {row.client_request_note?.trim() ? (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            <strong>{t('rentals.clientRequests.yourNote', 'Your note')}:</strong>{' '}
            {row.client_request_note.trim()}
          </Typography>
        ) : null}

        {priceChanged ? (
          <Alert severity="warning">
            {t('assistant.rental.priceChangedLead', 'The business changed the price:')}{' '}
            <strong>{formatRentalMoney(accepted, listing?.rental_item.currency || 'XAF')}</strong>
            {' '}
            {t('assistant.rental.priceChangedMid', 'instead of the estimated')}{' '}
            <s>{formatRentalMoney(quoted, listing?.rental_item.currency || 'XAF')}</s>
            {'. '}
            {t('assistant.rental.priceChangedTail', 'Check it before you confirm.')}
          </Alert>
        ) : null}

        {quote ? (
          <Box
            sx={{
              py: 1,
              px: 1.5,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.success.main, 0.08),
              border: 1,
              borderColor: alpha(theme.palette.success.main, 0.25),
            }}
          >
            <Typography variant="caption" color="text.secondary" display="block">
              {t('rentals.clientRequests.quotedTotal', 'Quoted total')}
            </Typography>
            <Typography variant="subtitle1" fontWeight={800} color="success.dark">
              {formatRentalMoney(quote.total, quote.currency)}
            </Typography>
          </Box>
        ) : null}

        {row.status === 'available' && deadlineIso ? (
          <Typography
            variant="body2"
            color={canBookNow ? 'text.secondary' : 'error'}
            fontWeight={canBookNow ? 400 : 600}
          >
            {canBookNow
              ? t('rentals.clientRequests.contractCompleteBy', 'Complete booking by {{date}}', {
                  date: formatRentalRequestLocalDateTime(deadlineIso),
                })
              : t('rentals.clientRequests.contractExpiredHint', 'This offer has expired. Send a new request from the listing.')}
          </Typography>
        ) : null}

        {row.status === 'unavailable' && reasonCode ? (
          <Typography variant="body2" color="text.secondary">
            <strong>{t('rentals.clientRequests.unavailableReason', 'Reason')}:</strong>{' '}
            {t(`rentals.unavailableReasons.${reasonCode}`, reasonCode)}
          </Typography>
        ) : null}

        {row.business_response_note?.trim() ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            {t('rentals.clientRequests.businessNote', 'Business note')}: {row.business_response_note}
          </Typography>
        ) : null}

        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ pt: 0.5 }}>
          {listing?.id ? (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onViewListing(listing.id)}
            >
              {t('rentals.clientRequests.viewListing', 'View listing')}
            </Button>
          ) : null}
          {row.status === 'available' ? (
            <>
              <Button
                size="small"
                variant="contained"
                disabled={bookingLoading}
                onClick={() => onBookRequest(row.id)}
              >
                {t('rentals.bookNow', 'Book now')}
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => onCancel(row.id)}
              >
                {t('rentals.clientRequests.cancelOffer', 'Cancel reservation')}
              </Button>
            </>
          ) : null}
          {row.status === 'pending' ? (
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => onCancel(row.id)}
            >
              {t('rentals.clientRequests.cancelRequest', 'Cancel request')}
            </Button>
          ) : null}
          {row.status === 'booked' && bookingId ? (
            <Button
              size="small"
              variant="contained"
              color="info"
              onClick={() => onViewBooking(bookingId)}
            >
              {t('rentals.actions.openBooking', 'Open booking')}
            </Button>
          ) : null}
        </Stack>
        </Stack>
      </Paper>
  );
};
