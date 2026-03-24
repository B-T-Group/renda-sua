import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BusinessRentalRequestRow } from '../../hooks/useRentalApi';

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
  const firstName = request.client?.user?.first_name?.trim() || '';
  const lastName = request.client?.user?.last_name?.trim() || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const email = request.client?.user?.email?.trim() || '';
  const phone = request.client?.user?.phone_number?.trim() || '';

  return (
    <Paper
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        p: 2,
        mb: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {request.rental_location_listing?.rental_item?.name}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {formatDateTimeWithoutTimezone(request.requested_start_at)} ->{' '}
        {formatDateTimeWithoutTimezone(request.requested_end_at)}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
        {t('business.rentals.requestCreatedAt', 'Requested on')}: {formatDateOnly(request.created_at)}
      </Typography>

      {(fullName || email || phone) && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('business.rentals.clientDetails', 'Client details')}
          </Typography>
          {fullName ? (
            <Typography variant="body2">
              {t('common.name', 'Name')}: {fullName}
            </Typography>
          ) : null}
          {phone ? (
            <Typography variant="body2">
              {t('common.phone', 'Phone')}: {phone}
            </Typography>
          ) : null}
          {email ? (
            <Typography variant="body2">
              {t('common.email', 'Email')}: {email}
            </Typography>
          ) : null}
        </Box>
      )}

      {request.client_request_note?.trim() ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
          {t('business.rentals.clientRequestNote', 'Client note')}: {request.client_request_note.trim()}
        </Typography>
      ) : null}
      <Chip
        size="small"
        sx={{ mt: 1 }}
        label={`${t('common.status', 'Status')}: ${request.status}`}
      />

      {request.status === 'pending' && (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" onClick={() => onAccept(request)}>
            {t('business.rentals.accept', 'Accept')}
          </Button>
          <Button size="small" color="warning" onClick={() => onReject(request)}>
            {t('business.rentals.reject', 'Reject')}
          </Button>
        </Stack>
      )}
    </Paper>
  );
};
