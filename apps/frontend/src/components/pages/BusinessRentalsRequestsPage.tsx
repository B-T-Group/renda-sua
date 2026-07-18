import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
import {
  BUSINESS_QUEUE_FILTERS,
  matchesBusinessQueue,
  resolveRentalPhase,
  type BusinessActionQueue,
} from '../../utils/rentalPhase';

const QUEUE_LABELS: Record<BusinessActionQueue, [string, string]> = {
  respond: ['rentals.queue.respond', 'Respond'],
  collect_pay: ['rentals.queue.collectPay', 'Collect pay'],
  start: ['rentals.queue.start', 'Start'],
  return: ['rentals.queue.return', 'Return'],
  all: ['rentals.queue.all', 'All'],
};

const BusinessRentalsRequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const businessId = profile?.business?.id;
  const { respondRequest, fetchBusinessRentalRequests } = useRentalApi();
  const [requests, setRequests] = useState<BusinessRentalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState<BusinessActionQueue>('all');
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

  const queuedRequests = useMemo(() => {
    return sortedRequests.filter((r) => {
      if (r.status === 'unavailable') return false;
      const info = resolveRentalPhase(
        {
          requestStatus: r.status,
          bookingStatus: r.rental_booking?.status ?? null,
        },
        'business'
      );
      return matchesBusinessQueue(info, queueFilter);
    });
  }, [queueFilter, sortedRequests]);

  const unavailableRequests = useMemo(
    () => sortedRequests.filter((r) => r.status === 'unavailable'),
    [sortedRequests]
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
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={queueFilter}
            onChange={(_e, value: BusinessActionQueue | null) => {
              if (value) setQueueFilter(value);
            }}
            sx={{ flexWrap: 'wrap' }}
          >
            {BUSINESS_QUEUE_FILTERS.map((q) => (
              <ToggleButton key={q} value={q} sx={{ flex: '1 1 auto', minWidth: 72 }}>
                {t(QUEUE_LABELS[q][0], QUEUE_LABELS[q][1])}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Paper>

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

        {requests.length > 0 && queuedRequests.length === 0 ? (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t('business.rentals.emptyQueue', 'No items in this queue.')}
          </Typography>
        ) : null}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {queuedRequests.map((req) => (
            <BusinessRentalRequestCard
              key={req.id}
              request={req}
              onAccept={(selected) => setRespondTarget({ req: selected, mode: 'available' })}
              onReject={(selected) => setRespondTarget({ req: selected, mode: 'unavailable' })}
            />
          ))}
        </Box>

        {unavailableRequests.length > 0 &&
        (queueFilter === 'all' || queueFilter === 'respond') ? (
          <Accordion
            defaultExpanded={false}
            elevation={0}
            sx={{
              mt: 2,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={800}>
                {t('rentals.unavailable', 'Unavailable')} ({unavailableRequests.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {unavailableRequests.map((req) => (
                  <BusinessRentalRequestCard
                    key={req.id}
                    request={req}
                    onAccept={(selected) =>
                      setRespondTarget({ req: selected, mode: 'available' })
                    }
                    onReject={(selected) =>
                      setRespondTarget({ req: selected, mode: 'unavailable' })
                    }
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        ) : null}
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
