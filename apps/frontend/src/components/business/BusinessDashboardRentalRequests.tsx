import { Box, Button, Chip, IconButton, Stack, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useClientFlags } from '../../hooks/useClientFlags';
import { useBusinessReturnConfirmations } from '../../hooks/useBusinessReturnConfirmations';
import { useRentalApi, type BusinessRentalRequestRow, type BusinessReturnConfirmationRow } from '../../hooks/useRentalApi';
import { isInspectionEnrolled } from '../../utils/rentalInspection';
import { BusinessRentalRespondDialog } from '../rentals/BusinessRentalRespondDialog';
import { compareSoonestRequestStart } from '../../utils/dashboardRentalRequests';
import { brandTokens } from '../../theme/brandTokens';
import { BusinessDashboardRentalRequestCard } from './BusinessDashboardRentalRequestCard';
import { BusinessDashboardReturnConfirmationCard } from './BusinessDashboardReturnConfirmationCard';
import { BusinessReturnConfirmDialog } from './BusinessReturnConfirmDialog';

type Notice = { id: string; itemName: string; renterName: string; window: 'sla' | 'start' };

/** Approved 26 Nov 2026 notice accent — softer than the old solid amber Alert fill. */
const AMBER_EDGE = '#E8A23A';

export function BusinessDashboardRentalRequests() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { flags, loaded } = useClientFlags();
  const { fetchDashboardRentalRequests, respondRequest, dismissExpiryNotice } = useRentalApi();
  const [requests, setRequests] = useState<BusinessRentalRequestRow[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [target, setTarget] = useState<{ req: BusinessRentalRequestRow; mode: 'available' | 'unavailable' } | null>(null);
  const [confirmRow, setConfirmRow] = useState<BusinessReturnConfirmationRow | null>(null);
  const enabled = loaded && flags.rentals_dashboard_requests_enabled;
  const returns = useBusinessReturnConfirmations(loaded && flags.rentals_renter_return_report_enabled === true);

  const load = useCallback(async () => {
    const data = await fetchDashboardRentalRequests();
    setRequests([...data.requests].sort(compareSoonestRequestStart));
    setNotices(data.expiryNotices);
  }, [fetchDashboardRentalRequests]);

  useEffect(() => {
    if (!enabled) return;
    void load().catch(() => undefined);
  }, [enabled, load]);

  const onSuccess = useCallback((mode: 'available' | 'unavailable', item: string) => {
    if (target) setRequests((rows) => rows.filter((row) => row.id !== target.req.id));
    const key = mode === 'available' ? 'business.dashboard.rentalRequests.acceptedToast' : 'business.dashboard.rentalRequests.declinedToast';
    const fallback = mode === 'available' ? 'Request accepted for {{item}}' : 'Request declined for {{item}}';
    enqueueSnackbar(t(key, fallback, { item }), { variant: mode === 'available' ? 'success' : 'info' });
  }, [enqueueSnackbar, t, target]);

  const openBooking = useCallback(
    (row: BusinessReturnConfirmationRow, hash = '') => navigate(`/rentals/bookings/${row.id}${hash}`),
    [navigate]
  );

  const onConfirmReturn = useCallback(
    (row: BusinessReturnConfirmationRow) => {
      if (isInspectionEnrolled(row)) openBooking(row, '#rental-inspection');
      else setConfirmRow(row);
    },
    [openBooking]
  );

  const settleReturn = useCallback(async () => {
    const row = confirmRow;
    if (!row) return;
    setConfirmRow(null);
    const item = row.rental_location_listing.rental_item.name;
    try {
      const overtime = await returns.confirm(row);
      const message = overtime
        ? t('business.dashboard.rentalReturns.overtimeToast', 'Return confirmed for {{item}}. The renter was asked to pay for the extra time.', { item })
        : t('business.dashboard.rentalReturns.confirmedToast', 'Return confirmed for {{item}}', { item });
      enqueueSnackbar(message, { variant: 'success' });
    } catch (error: unknown) {
      enqueueSnackbar(error instanceof Error ? error.message : t('business.dashboard.rentalReturns.failed', 'Could not confirm the return'), { variant: 'error' });
    }
  }, [confirmRow, enqueueSnackbar, returns, t]);

  const currentNotice = notices[0];

  const onDismissNotice = useCallback(
    (id: string) => {
      setNotices((rows) => rows.filter((row) => row.id !== id));
      void dismissExpiryNotice(id).catch(() => undefined);
    },
    [dismissExpiryNotice]
  );

  const hasReturns = returns.rows.length > 0;
  const itemCount = returns.rows.length + requests.length;
  if (itemCount === 0 && notices.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }} component="section" aria-label={
      hasReturns
        ? t('business.dashboard.rentalReturns.sectionA11y', 'Rental actions, {{count}}', { count: itemCount })
        : t('business.dashboard.rentalRequests.sectionA11y', 'Rental requests, {{count}}', { count: requests.length })
    }>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="overline">
            {hasReturns
              ? t('business.dashboard.rentalReturns.sectionTitle', 'Rental actions')
              : t('business.dashboard.rentalRequests.sectionTitle', 'Rental requests')}
          </Typography>
          {itemCount > 0 ? <Chip size="small" color="primary" label={itemCount} /> : null}
        </Stack>
        <Button size="small" onClick={() => navigate(requests.length > 0 ? '/business/rentals/requests' : '/business/rentals/schedule')}>
          {t('business.dashboard.rentalRequests.seeAll', 'See all')}
        </Button>
      </Stack>
      {currentNotice ? (
        <ExpiryNotice
          notice={currentNotice}
          onDismiss={() => onDismissNotice(currentNotice.id)}
          onView={() => navigate(`/business/rentals/requests?request=${encodeURIComponent(currentNotice.id)}`)}
        />
      ) : null}
      {itemCount > 0 ? (
        <Stack spacing={1.5}>
          {returns.rows.map((row) => (
            <BusinessDashboardReturnConfirmationCard
              key={`return-${row.id}`}
              row={row}
              busy={returns.busyId === row.id}
              onOpen={(target) => openBooking(target)}
              onConfirm={onConfirmReturn}
              onProblem={(target) => openBooking(target, '#rental-inspection')}
            />
          ))}
          {requests.map((request) => (
            <BusinessDashboardRentalRequestCard
              key={request.id}
              request={request}
              onAccept={(req) => setTarget({ req, mode: 'available' })}
              onDecline={(req) => setTarget({ req, mode: 'unavailable' })}
            />
          ))}
        </Stack>
      ) : null}
      <BusinessReturnConfirmDialog
        open={confirmRow != null}
        itemName={confirmRow?.rental_location_listing.rental_item.name ?? ''}
        onClose={() => setConfirmRow(null)}
        onConfirm={() => void settleReturn()}
      />
      <BusinessRentalRespondDialog
        open={target != null}
        mode={target?.mode ?? null}
        request={target?.req ?? null}
        respondRequest={respondRequest}
        onClose={() => setTarget(null)}
        onSuccess={() => target && onSuccess(target.mode, target.req.rental_location_listing.rental_item.name)}
      />
    </Box>
  );
}

function ExpiryNotice({
  notice,
  onDismiss,
  onView,
}: {
  notice: Notice;
  onDismiss: () => void;
  onView: () => void;
}) {
  const { t } = useTranslation();
  const reason =
    notice.window === 'start'
      ? t(
          'business.dashboard.rentalRequests.expiredStartReason',
          "You didn't reply before the start time. The renter can send a new request."
        )
      : t(
          'business.dashboard.rentalRequests.expiredSlaReason',
          "You didn't reply within 24 hours. The renter can send a new request."
        );
  const who = [notice.itemName, notice.renterName].filter(Boolean).join(' · ');
  const viewLabel = t('business.dashboard.rentalRequests.viewRequest', 'View request');
  return (
    <Box
      data-testid="rental-request-expiry-notice"
      sx={{
        position: 'relative',
        mb: 1.5,
        px: 2,
        py: 1.5,
        pl: 2.5,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          left: 0,
          top: 10,
          bottom: 10,
          width: '4px',
          bgcolor: AMBER_EDGE,
          borderTopRightRadius: '4px',
          borderBottomRightRadius: '4px',
        }}
      />
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          aria-hidden
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: brandTokens.warning.soft,
            color: AMBER_EDGE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AccessTimeIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {t('business.dashboard.rentalRequests.expiredTitle', 'Request expired')}
          </Typography>
          {who ? (
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
              {who}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {reason}
          </Typography>
          <Button
            data-testid="rental-request-expiry-view"
            variant="contained"
            size="small"
            disableElevation
            startIcon={<ArrowForwardIcon />}
            onClick={onView}
            aria-label={viewLabel}
            sx={{
              mt: 1.25,
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '20px',
              px: 1.75,
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            {viewLabel}
          </Button>
        </Box>
        <IconButton
          data-testid="rental-request-expiry-dismiss"
          size="small"
          onClick={onDismiss}
          aria-label={t('business.dashboard.rentalRequests.dismissNotice', 'Dismiss')}
          sx={{
            bgcolor: brandTokens.surface.input,
            width: 28,
            height: 28,
            '&:hover': { bgcolor: brandTokens.surface.subtle },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>
    </Box>
  );
}
