import {
  Alert,
  Avatar,
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
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { BusinessRentalRequestRow } from '../../hooks/useRentalApi';
import { useRentalApi } from '../../hooks/useRentalApi';
import { PinCodeFields } from '../common/PinCodeFields';

function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return err instanceof Error && err.message ? err.message : fallback;
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
  onStartRentalSuccess?: () => void;
}

export const BusinessRentalRequestCard: React.FC<BusinessRentalRequestCardProps> = ({
  request,
  onAccept,
  onReject,
  onStartRentalSuccess,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const api = useRentalApi();
  const firstName = request.client?.user?.first_name?.trim() || '';
  const lastName = request.client?.user?.last_name?.trim() || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const email = request.client?.user?.email?.trim() || '';
  const phone = request.client?.user?.phone_number?.trim() || '';
  const booking = request.rental_booking ?? null;
  const bookingIsConfirmed = booking?.status === 'confirmed';
  const bookingIsActive = booking?.status === 'active';
  const actualStartAt = booking?.actual_start_at ?? null;
  const itemName = request.rental_location_listing?.rental_item?.name ?? '—';
  const img = request.rental_location_listing?.rental_item?.rental_item_images?.[0];
  const imgUrl = img?.image_url?.trim() || '';
  const imgAlt = img?.alt_text?.trim() || itemName;

  const [startModalOpen, setStartModalOpen] = useState(false);
  const [startPin, setStartPin] = useState('');
  const [startSubmitting, setStartSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startSuccess, setStartSuccess] = useState<string | null>(null);

  const displayStatus = useMemo(() => {
    if (booking?.status === 'active') return 'active';
    return request.status;
  }, [booking?.status, request.status]);

  const statusChipColor = useMemo(() => {
    if (displayStatus === 'active') return 'success' as const;
    if (request.status === 'pending') return 'warning' as const;
    if (request.status === 'available') return 'success' as const;
    if (request.status === 'unavailable') return 'error' as const;
    if (request.status === 'booked') return 'info' as const;
    if (request.status === 'expired') return 'default' as const;
    if (request.status === 'cancelled') return 'default' as const;
    return 'default' as const;
  }, [displayStatus, request.status]);

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
        {imgUrl ? (
          <Box
            component="img"
            src={imgUrl}
            alt={imgAlt}
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

        <Stack spacing={1.15} sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.15 }} noWrap>
                {itemName}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.35, fontWeight: 600 }}
              >
                {formatDateTimeWithoutTimezone(request.requested_start_at)} →{' '}
                {formatDateTimeWithoutTimezone(request.requested_end_at)}
              </Typography>
            </Box>
            <Chip
              size="small"
              color={statusChipColor}
              sx={{ fontWeight: 800, flexShrink: 0 }}
              label={
                displayStatus === 'active'
                  ? t('rentals.inProgress', 'In progress')
                  : t(`rentals.requestStatus.${request.status}`, request.status)
              }
            />
          </Stack>

          <Typography variant="caption" color="text.secondary">
            {t('business.rentals.requestCreatedAt', 'Requested on')}:{' '}
            {formatDateOnly(request.created_at)}
          </Typography>

          {bookingIsActive && actualStartAt ? (
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {t('rentals.startedAt', 'Started at')}:{' '}
              {formatDateTimeWithoutTimezone(actualStartAt)}
            </Typography>
          ) : null}

          {startSuccess ? (
            <Alert severity="success" sx={{ mt: 0.25 }}>
              {startSuccess}
            </Alert>
          ) : null}

          {bookingIsConfirmed && (fullName || email || phone) ? (
            <Box
              sx={{
                mt: 0.15,
                p: 1.25,
                borderRadius: 2,
                border: 1,
                borderColor: alpha(theme.palette.info.main, 0.25),
                bgcolor: alpha(theme.palette.info.main, 0.06),
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block">
                {t('business.rentals.clientDetails', 'Client details')}
              </Typography>
              {fullName ? (
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {t('common.name', 'Name')}: {fullName}
                </Typography>
              ) : null}
              {phone ? (
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {t('common.phone', 'Phone')}: {phone}
                </Typography>
              ) : null}
              {email ? (
                <Typography variant="body2" color="text.secondary">
                  {t('common.email', 'Email')}: {email}
                </Typography>
              ) : null}
            </Box>
          ) : null}

          {request.client_request_note?.trim() ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.15, whiteSpace: 'pre-wrap' }}
            >
              <strong>{t('business.rentals.clientRequestNote', 'Client note')}:</strong>{' '}
              {request.client_request_note.trim()}
            </Typography>
          ) : null}

          <Box sx={{ flex: 1 }} />

          <Stack
            direction="row"
            spacing={1}
            sx={{ pt: 0.25, flexWrap: 'wrap', justifyContent: 'flex-end' }}
          >
            {request.status === 'pending' ? (
              <>
                <Button size="small" variant="contained" onClick={() => onAccept(request)}>
                  {t('business.rentals.accept', 'Accept')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={() => onReject(request)}
                >
                  {t('business.rentals.reject', 'Reject')}
                </Button>
              </>
            ) : null}

            {request.status === 'booked' && bookingIsConfirmed && booking?.id ? (
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={() => {
                  setStartError(null);
                  setStartSuccess(null);
                  setStartPin('');
                  setStartModalOpen(true);
                }}
              >
                {t('business.rentals.startRental', 'Start rental')}
              </Button>
            ) : null}

            {booking?.id ? (
              <Button
                size="small"
                variant="outlined"
                onClick={() => navigate(`/rentals/bookings/${booking.id}`)}
              >
                {t('rentals.clientRequests.viewBooking', 'View reservation')}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Stack>

      <Dialog
        open={startModalOpen}
        onClose={() => !startSubmitting && setStartModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('business.rentals.startRental', 'Start rental')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t(
              'business.rentals.startRentalHint',
              'Ask the client for their start PIN and enter it to begin the rental.'
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {t('rentals.clientPin', 'Client PIN')}
          </Typography>
          <PinCodeFields
            value={startPin}
            onChange={setStartPin}
            length={4}
            disabled={startSubmitting}
            autoFocus
          />
          {startError ? (
            <Alert severity="error" sx={{ mt: 1.25 }}>
              {startError}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStartModalOpen(false)} disabled={startSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={startSubmitting || startPin.trim().length !== 4 || !booking?.id}
            onClick={async () => {
              if (!booking?.id) return;
              setStartSubmitting(true);
              setStartError(null);
              try {
                await api.verifyStartPin(booking.id, { pin: startPin.trim() });
                setStartModalOpen(false);
                setStartSuccess(t('rentals.started', 'Rental started'));
                onStartRentalSuccess?.();
              } catch (e: unknown) {
                setStartError(
                  apiErrorMessage(e, t('common.error', 'Error'))
                );
              } finally {
                setStartSubmitting(false);
              }
            }}
          >
            {t('business.rentals.confirmStart', 'Start')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
