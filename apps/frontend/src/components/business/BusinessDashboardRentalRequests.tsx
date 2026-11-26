import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useClientFlags } from '../../hooks/useClientFlags';
import { useRentalApi, type BusinessRentalRequestRow } from '../../hooks/useRentalApi';
import { BusinessRentalRespondDialog } from '../rentals/BusinessRentalRespondDialog';
import { compareSoonestRequestStart } from '../../utils/dashboardRentalRequests';
import { BusinessDashboardRentalRequestCard } from './BusinessDashboardRentalRequestCard';
import { RentalRequestExpiredBanner } from './RentalRequestExpiredBanner';

type Notice = { id: string; itemName: string; renterName: string; window: 'sla' | 'start' };

export function BusinessDashboardRentalRequests() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { flags, loaded } = useClientFlags();
  const { fetchDashboardRentalRequests, respondRequest } = useRentalApi();
  const [requests, setRequests] = useState<BusinessRentalRequestRow[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [target, setTarget] = useState<{ req: BusinessRentalRequestRow; mode: 'available' | 'unavailable' } | null>(null);
  const enabled = loaded && flags.rentals_dashboard_requests_enabled;

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

  const currentNotice = notices[0];

  if (!enabled || (requests.length === 0 && notices.length === 0)) return null;

  return (
    <Box sx={{ mb: 3 }} component="section" aria-label={t('business.dashboard.rentalRequests.sectionA11y', 'Rental requests, {{count}}', { count: requests.length })}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="overline">{t('business.dashboard.rentalRequests.sectionTitle', 'Rental requests')}</Typography>
          {requests.length > 0 ? <Chip size="small" color="primary" label={requests.length} /> : null}
        </Stack>
        <Button size="small" onClick={() => navigate('/business/rentals/requests')}>
          {t('business.dashboard.rentalRequests.seeAll', 'See all')}
        </Button>
      </Stack>
      {currentNotice ? (
        <ExpiryNotice
          notice={currentNotice}
          onDismiss={() => setNotices((rows) => rows.slice(1))}
          onView={() => navigate(`/business/rentals/requests?request=${encodeURIComponent(currentNotice.id)}`)}
        />
      ) : null}
      {requests.length > 0 ? (
        <Stack spacing={1.5}>
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
  const who = [notice.itemName, notice.renterName].filter(Boolean).join(' · ');
  return (
    <RentalRequestExpiredBanner
      window={notice.window}
      who={who}
      onView={onView}
      onDismiss={onDismiss}
      testId="rental-request-expiry-notice"
      sx={{ mb: 1.5 }}
    />
  );
}
