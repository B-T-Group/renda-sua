import { CalendarMonth, LocationOn, OpenInNew } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRentalApi, type ClientRentalRequestRow } from '../../hooks/useRentalApi';
import {
  formatRentalMoney,
  formatRentalRequestLocalDateTime,
  parseRentalPricingSnapshot,
  proposedContractDeadlineIso,
} from '../../utils/rentalRequestDisplay';

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
  const api = useRentalApi();
  const [pinInfo, setPinInfo] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const listing = row.rental_location_listing;
  const itemName = listing?.rental_item?.name ?? t('rentals.clientRequests.unknownItem', 'Rental');
  const locName = listing?.business_location?.name;
  const quote = parseRentalPricingSnapshot(row.rental_pricing_snapshot);
  const statusLabel = t(`rentals.requestStatus.${row.status}`, row.status);
  const deadlineIso = proposedContractDeadlineIso(row);
  const canBookNow = row.status === 'available' && isProposedContractOpen(row);
  const reasonCode = row.unavailable_reason_code?.trim();
  const bookingId = row.rental_booking?.id;
  const bookingStatus = row.rental_booking?.status;
  const canRevealPin = row.status === 'booked' && bookingId && bookingStatus === 'confirmed';

  return (
    <>
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
              {formatRentalRequestLocalDateTime(row.requested_start_at)} —{' '}
              {formatRentalRequestLocalDateTime(row.requested_end_at)}
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
          {row.status === 'booked' && bookingId ? (
            <>
              {canRevealPin ? (
                <Button
                  size="small"
                  variant="outlined"
                  disabled={pinLoading}
                  onClick={async () => {
                    setPinLoading(true);
                    try {
                      const r = await api.getStartPin(bookingId);
                      setPinInfo(r.pin);
                      setPinModalOpen(true);
                    } catch (e: unknown) {
                      setPinInfo(null);
                      setPinModalOpen(false);
                    } finally {
                      setPinLoading(false);
                    }
                  }}
                >
                  {t('rentals.showStartPin', 'Show start PIN')}
                </Button>
              ) : null}
              <Button
                size="small"
                variant="contained"
                color="info"
                onClick={() => onViewBooking(bookingId)}
              >
                {t('rentals.clientRequests.viewBooking', 'View booking')}
              </Button>
            </>
          ) : null}
        </Stack>
        </Stack>
      </Paper>

      <Dialog
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {t('rentals.showStartPin', 'Show start PIN')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('rentals.yourPin', 'Your start PIN')}
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 900,
              letterSpacing: 4,
              textAlign: 'center',
              py: 1,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.info.main, 0.06),
            }}
          >
            {pinInfo ?? '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.25 }}>
            {t(
              'rentals.pinShareHint',
              'Share this code with the owner to start the rental.'
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPinModalOpen(false)}>
            {t('common.close', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
