import { CalendarMonth, LocationOn, OpenInNew } from '@mui/icons-material';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientRentalRequestRow } from '../../hooks/useRentalApi';

function formatLocalDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function parseSnapshot(snap: unknown): { total: number; currency: string } | null {
  if (!snap || typeof snap !== 'object') return null;
  const o = snap as Record<string, unknown>;
  const total = o.total;
  const currency = o.currency;
  if (typeof total !== 'number' || typeof currency !== 'string') return null;
  return { total, currency };
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'XAF',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function statusChipColor(
  status: string
): 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info' {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'available':
      return 'success';
    case 'unavailable':
      return 'error';
    case 'booked':
      return 'info';
    default:
      return 'default';
  }
}

export function isProposedContractOpen(row: ClientRentalRequestRow): boolean {
  if (row.status !== 'available') return false;
  const b = row.rental_booking;
  if (!b || b.status !== 'proposed') return true;
  const exp = b.contract_expires_at;
  if (!exp) return true;
  return new Date(exp) > new Date();
}

function proposedContractDeadline(row: ClientRentalRequestRow): string | null {
  const b = row.rental_booking;
  if (b?.status !== 'proposed' || !b.contract_expires_at) return null;
  return b.contract_expires_at;
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
  const { t } = useTranslation();
  const theme = useTheme();
  const listing = row.rental_location_listing;
  const itemName = listing?.rental_item?.name ?? t('rentals.clientRequests.unknownItem', 'Rental');
  const locName = listing?.business_location?.name;
  const quote = parseSnapshot(row.rental_pricing_snapshot);
  const statusLabel = t(`rentals.requestStatus.${row.status}`, row.status);
  const deadlineIso = proposedContractDeadline(row);
  const canBookNow = row.status === 'available' && isProposedContractOpen(row);
  const reasonCode = row.unavailable_reason_code?.trim();

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
          <Chip
            label={statusLabel}
            color={statusChipColor(row.status)}
            size="small"
            sx={{ fontWeight: 600, flexShrink: 0 }}
          />
        </Stack>

        <Stack direction="row" alignItems="flex-start" gap={1}>
          <CalendarMonth sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }} />
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('rentals.clientRequests.requestedPeriod', 'Requested period')}
            </Typography>
            <Typography variant="body2" fontWeight={500}>
              {formatLocalDateTime(row.requested_start_at)} —{' '}
              {formatLocalDateTime(row.requested_end_at)}
            </Typography>
          </Box>
        </Stack>

        {row.client_request_note?.trim() ? (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            <strong>{t('rentals.clientRequests.yourNote', 'Your note')}:</strong>{' '}
            {row.client_request_note.trim()}
          </Typography>
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
              {formatMoney(quote.total, quote.currency)}
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
                  date: formatLocalDateTime(deadlineIso),
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
              endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
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
          {row.status === 'booked' && row.rental_booking?.id ? (
            <Button
              size="small"
              variant="contained"
              color="info"
              onClick={() => onViewBooking(row.rental_booking!.id)}
            >
              {t('rentals.clientRequests.viewBooking', 'View booking')}
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
};
