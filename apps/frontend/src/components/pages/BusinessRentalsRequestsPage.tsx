import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Paper,
  Typography,
} from '@mui/material';
import AppsIcon from '@mui/icons-material/Apps';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PaymentsIcon from '@mui/icons-material/Payments';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplyIcon from '@mui/icons-material/Reply';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useClientFlags } from '../../hooks/useClientFlags';
import { compareSoonestRequestStart } from '../../utils/dashboardRentalRequests';
import {
  useRentalApi,
  type BusinessRentalRequestRow,
} from '../../hooks/useRentalApi';
import { BusinessDashboardRentalRequestCard } from '../business/BusinessDashboardRentalRequestCard';
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

const QUEUE_ICONS: Record<BusinessActionQueue, typeof ReplyIcon> = {
  respond: ReplyIcon,
  collect_pay: PaymentsIcon,
  start: PlayArrowIcon,
  return: AssignmentReturnIcon,
  all: AppsIcon,
};

const BusinessRentalsRequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const { flags } = useClientFlags();
  const { profile } = useUserProfileContext();
  const businessId = profile?.business?.id;
  const [searchParams] = useSearchParams();
  const focusRequestId = searchParams.get('request');
  const { respondRequest, fetchBusinessRentalRequests } = useRentalApi();
  const [requests, setRequests] = useState<BusinessRentalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState<BusinessActionQueue>('respond');
  const [queueTouched, setQueueTouched] = useState(false);
  const [staleBanner, setStaleBanner] = useState(false);
  const [respondTarget, setRespondTarget] = useState<{
    req: BusinessRentalRequestRow;
    mode: 'available' | 'unavailable';
  } | null>(null);
  const [unavailableExpanded, setUnavailableExpanded] = useState(false);

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

  useEffect(() => {
    if (queueTouched || loading || requests.length === 0) return;
    if (!requests.some((row) => row.status === 'pending')) setQueueFilter('all');
  }, [loading, queueTouched, requests]);

  const sortedRequests = useMemo(() => {
    if (flags.rentals_dashboard_requests_enabled) {
      return [...requests].sort(compareSoonestRequestStart);
    }
    return [...requests].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });
  }, [flags.rentals_dashboard_requests_enabled, requests]);

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


  useEffect(() => {
    if (!focusRequestId || loading) return undefined;
    if (!unavailableRequests.some((row) => row.id === focusRequestId)) return undefined;
    setUnavailableExpanded(true);
    const timer = window.setTimeout(() => {
      document.getElementById(`rental-request-${focusRequestId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [focusRequestId, loading, unavailableRequests]);

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
        {staleBanner ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('rentals.modify.staleBanner', 'This request was updated. Review the latest version.')}
          </Alert>
        ) : null}
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', mb: 2, pb: 0.5 }}>
          {BUSINESS_QUEUE_FILTERS.map((q) => {
            const Icon = QUEUE_ICONS[q];
            const selected = queueFilter === q;
            return (
              <Chip
                key={q}
                icon={<Icon />}
                label={t(QUEUE_LABELS[q][0], QUEUE_LABELS[q][1])}
                clickable
                color={selected ? 'primary' : 'default'}
                variant={selected ? 'filled' : 'outlined'}
                onClick={() => {
                  setQueueTouched(true);
                  setQueueFilter(q);
                }}
                sx={{ flexShrink: 0 }}
              />
            );
          })}
        </Box>

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
          {queuedRequests.map((req) =>
            flags.rentals_dashboard_requests_enabled && req.status === 'pending' ? (
              <BusinessDashboardRentalRequestCard
                key={req.id}
                request={req}
                onAccept={(selected) => setRespondTarget({ req: selected, mode: 'available' })}
                onDecline={(selected) => setRespondTarget({ req: selected, mode: 'unavailable' })}
              />
            ) : (
              <BusinessRentalRequestCard
                key={req.id}
                request={req}
                onAccept={(selected) => setRespondTarget({ req: selected, mode: 'available' })}
                onReject={(selected) => setRespondTarget({ req: selected, mode: 'unavailable' })}
              />
            )
          )}
        </Box>

        {unavailableRequests.length > 0 &&
        (queueFilter === 'all' || queueFilter === 'respond') ? (
          <Accordion
            expanded={unavailableExpanded}
            onChange={(_event, expanded) => setUnavailableExpanded(expanded)}
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
                  <Box key={req.id} id={`rental-request-${req.id}`}>
                    <BusinessRentalRequestCard
                      request={req}
                      onAccept={(selected) =>
                        setRespondTarget({ req: selected, mode: 'available' })
                      }
                      onReject={(selected) =>
                        setRespondTarget({ req: selected, mode: 'unavailable' })
                      }
                    />
                  </Box>
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
        onStale={() => {
          setStaleBanner(true);
          void loadRequests();
        }}
        respondRequest={respondRequest}
      />
    </>
  );
};

export default BusinessRentalsRequestsPage;
