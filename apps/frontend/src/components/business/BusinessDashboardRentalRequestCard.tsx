import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { Avatar, Box, Chip, IconButton, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BusinessRentalRequestRow } from '../../hooks/useRentalApi';
import {
  dashboardPeriodLabel,
  formatYouReceive,
  requestPhotoUrl,
  respondWithinAmber,
  respondWithinHours,
  startInDays,
  youReceiveAmount,
} from '../../utils/dashboardRentalRequests';
import { parseRentalSelectionWindows } from '../../utils/rentalRequestDisplay';

export function BusinessDashboardRentalRequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: BusinessRentalRequestRow;
  onAccept: (request: BusinessRentalRequestRow) => void;
  onDecline: (request: BusinessRentalRequestRow) => void;
}) {
  const { t, i18n } = useTranslation();
  const windows = parseRentalSelectionWindows(request.rental_selection_windows);
  const period = dashboardPeriodLabel(
    windows,
    i18n.language,
    t('business.dashboard.rentalRequests.allDay', 'All day'),
    (count) => t('business.dashboard.rentalRequests.dayCount', '{{count}} days', { count })
  );
  const amount = youReceiveAmount(request);
  const currency = request.rental_location_listing.rental_item.currency || 'CAD';
  const hours = request.respond_by ? respondWithinHours(request.respond_by) : 0;
  const amber = request.respond_by ? respondWithinAmber(request.respond_by) : false;
  const daysOut = startInDays(windows[0]?.calendar_date, request.listing_timezone || 'America/Toronto');
  const renter = [request.client?.user?.first_name, request.client?.user?.last_name].filter(Boolean).join(' ');
  const photo = requestPhotoUrl(request);
  const updated = (request.change_summary?.fields?.length ?? 0) > 0;
  const daily = windows.length > 1 ? Number(request.rental_location_listing.base_price_per_day) : 0;

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <Avatar src={photo ?? undefined} variant="rounded" sx={{ width: 56, height: 56 }} alt="" />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography fontWeight={800} noWrap sx={{ flex: 1 }}>{request.rental_location_listing.rental_item.name}</Typography>
          <Chip size="small" label={t('business.dashboard.rentalRequests.requested', 'Requested')} />
          {daysOut === 0 ? <Chip size="small" color="info" label={t('business.dashboard.rentalRequests.startsToday', 'Starts today')} /> : null}
          {daysOut != null && daysOut > 0 ? (
            <Chip size="small" label={t('business.dashboard.rentalRequests.startsIn', 'Starts in {{count}} days', { count: daysOut })} />
          ) : null}
          {updated ? <Chip size="small" color="info" label={t('business.dashboard.rentalRequests.updated', 'Updated')} /> : null}
        </Stack>
        <Typography variant="body2" color="text.secondary" noWrap>
          {renter}{period ? ` · ${period}` : ''}
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          {amount != null ? (
            <Typography fontWeight={800}>
              {t('business.dashboard.rentalRequests.youReceive', 'You receive')} {formatYouReceive(amount, currency, i18n.language)}
            </Typography>
          ) : null}
          {hours > 0 ? (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: amber ? 'warning.dark' : 'text.secondary' }}>
              <AccessTimeIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2" fontWeight={800}>
                {t('business.dashboard.rentalRequests.respondWithin', 'Respond within {{hours}}h', { hours })}
              </Typography>
            </Stack>
          ) : null}
        </Stack>
        {daily > 0 ? (
          <Typography variant="caption" color="text.secondary">
            {t('business.dashboard.rentalRequests.dailyRate', '{{count}} days × {{rate}} / day', {
              count: windows.length,
              rate: formatYouReceive(daily, currency, i18n.language),
            })}
          </Typography>
        ) : null}
      </Box>
      <Stack direction="row" spacing={1}>
        <IconButton aria-label={t('business.dashboard.rentalRequests.accept', 'Accept')} color="success" onClick={() => onAccept(request)} sx={{ bgcolor: 'success.main', color: 'common.white', '&:hover': { bgcolor: 'success.dark' } }}>
          <CheckIcon />
        </IconButton>
        <IconButton aria-label={t('business.dashboard.rentalRequests.decline', 'Decline')} color="error" onClick={() => onDecline(request)} sx={{ border: 1, borderColor: 'divider' }}>
          <CloseIcon />
        </IconButton>
      </Stack>
    </Box>
  );
}
