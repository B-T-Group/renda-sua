import { Box, Paper, Typography } from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  useRentalApi,
  type BusinessRentalRequestRow,
} from '../../hooks/useRentalApi';
import { BusinessRentalRespondDialog } from '../rentals/BusinessRentalRespondDialog';
import { BusinessRentalRequestCard } from '../rentals/BusinessRentalRequestCard';
import BusinessRentalsStudioShell from '../rentals/BusinessRentalsStudioShell';
import LoadingPage from '../common/LoadingPage';

const BusinessRentalsRequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const businessId = profile?.business?.id;
  const { respondRequest, fetchBusinessRentalRequests } = useRentalApi();
  const [requests, setRequests] = useState<BusinessRentalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondTarget, setRespondTarget] = useState<{
    req: BusinessRentalRequestRow;
    mode: 'available' | 'unavailable';
  } | null>(null);

  const loadRequests = useCallback(async () => {
    const list = await fetchBusinessRentalRequests();
    setRequests(list);
  }, [fetchBusinessRentalRequests]);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadRequests()
      .catch((error: unknown) => {
        console.error('Failed to load rental requests', error);
      })
      .finally(() => setLoading(false));
  }, [businessId, loadRequests]);

  const sortedRequests = useMemo(
    () =>
      [...requests].sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
      }),
    [requests]
  );

  if (!businessId) {
    return (
      <Typography sx={{ p: 3 }}>
        {t('business.dashboard.noBusinessProfile')}
      </Typography>
    );
  }

  if (loading) {
    return <LoadingPage message={t('common.loading', 'Loading...')} showProgress />;
  }

  return (
    <>
      <BusinessRentalsStudioShell
        seoTitle={t('business.rentals.requestsPageTitle', 'Rental requests')}
        pageTitle={t('business.rentals.requestsPageTitle', 'Rental requests')}
        pageSubtitle={t(
          'business.rentals.requestsPageSubtitle',
          'Review and respond to client booking requests.'
        )}
      >
        {requests.length === 0 && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              textAlign: 'center',
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('business.rentals.emptyRequestsTitle', 'No booking requests')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {t(
                'business.rentals.emptyRequestsBody',
                'Incoming rental requests will appear here when clients submit them.'
              )}
            </Typography>
          </Paper>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {sortedRequests.map((req) => (
            <BusinessRentalRequestCard
              key={req.id}
              request={req}
              onAccept={(selected) => setRespondTarget({ req: selected, mode: 'available' })}
              onReject={(selected) => setRespondTarget({ req: selected, mode: 'unavailable' })}
            />
          ))}
        </Box>
      </BusinessRentalsStudioShell>

      <BusinessRentalRespondDialog
        open={!!respondTarget}
        mode={respondTarget?.mode ?? null}
        request={respondTarget?.req ?? null}
        onClose={() => setRespondTarget(null)}
        onSuccess={() => void loadRequests()}
        respondRequest={respondRequest}
      />
    </>
  );
};

export default BusinessRentalsRequestsPage;
