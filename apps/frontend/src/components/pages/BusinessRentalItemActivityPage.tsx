import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  useRentalApi,
  type BusinessRentalItemActivity,
  type BusinessRentalItemActivityBooking,
  type BusinessRentalItemActivityScope,
} from '../../hooks/useRentalApi';
import { formatDateTimeNoTimezone } from '../../utils/businessRentalsFormat';
import { formatRequestAmount } from '../../utils/rentalRequestDisplay';
import LoadingPage from '../common/LoadingPage';
import { RentalItemActivityStatsStrip } from '../rentals/RentalItemActivityStatsStrip';
import SEOHead from '../seo/SEOHead';

const BusinessRentalItemActivityPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const businessId = profile?.business?.id;
  const { fetchBusinessRentalItemActivity } = useRentalApi();
  const [scope, setScope] = useState<BusinessRentalItemActivityScope>('all');
  const [data, setData] = useState<BusinessRentalItemActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const suggestedApplied = useRef(false);

  const load = useCallback(
    async (nextScope?: BusinessRentalItemActivityScope) => {
      if (!itemId) return;
      setError(false);
      try {
        const requested = nextScope ?? scope;
        let next = await fetchBusinessRentalItemActivity(itemId, {
          scope: requested,
          limit: 50,
        });
        if (!next) {
          setError(true);
          return;
        }
        if (!suggestedApplied.current) {
          suggestedApplied.current = true;
          if (next.suggestedScope !== requested) {
            setScope(next.suggestedScope);
            next =
              (await fetchBusinessRentalItemActivity(itemId, {
                scope: next.suggestedScope,
                limit: 50,
              })) ?? next;
          }
        }
        setData(next);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [fetchBusinessRentalItemActivity, itemId, scope]
  );

  useEffect(() => {
    if (!businessId || !itemId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, itemId]);

  const onScopeChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (!value) return;
    const next = value as BusinessRentalItemActivityScope;
    setScope(next);
    void load(next);
  };

  if (!businessId) {
    return (
      <Typography sx={{ p: 3 }}>
        {t('business.dashboard.noBusinessProfile')}
      </Typography>
    );
  }

  if (loading && !data) {
    return <LoadingPage message={t('common.loading', 'Loading...')} showProgress />;
  }

  return (
    <>
      <SEOHead title={t('business.rentals.activity.title', 'Rental activity')} />
      <Box sx={{ p: 2, maxWidth: 900, mx: 'auto' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/business/rentals/items/${itemId}`)}
          sx={{ mb: 2 }}
        >
          {t('business.rentals.activity.backToItem', 'Back to rental')}
        </Button>

        {error && !data ? (
          <Paper sx={{ p: 3 }}>
            <Typography sx={{ mb: 1 }}>
              {t('business.rentals.activity.loadError', 'Could not load rental activity')}
            </Typography>
            <Button variant="contained" onClick={() => void load()}>
              {t('common.retry', 'Retry')}
            </Button>
          </Paper>
        ) : (
          <Stack spacing={2}>
            <Typography variant="h4" fontWeight={700}>
              {data?.item.name || t('business.rentals.activity.title', 'Rental activity')}
            </Typography>
            {data?.stats ? <RentalItemActivityStatsStrip stats={data.stats} /> : null}
            {data?.stats.openRequests ? (
              <Typography variant="body2" color="text.secondary">
                {t('business.rentals.activity.openRequests', '{{count}} open request(s)', {
                  count: data.stats.openRequests,
                })}
              </Typography>
            ) : null}
            <ToggleButtonGroup
              exclusive
              size="small"
              value={scope}
              onChange={onScopeChange}
              aria-label={t('business.rentals.activity.scopeA11y', 'Filter rentals')}
            >
              <ToggleButton value="upcoming">
                {t('business.rentals.activity.scopeUpcoming', 'Upcoming')}
              </ToggleButton>
              <ToggleButton value="past">
                {t('business.rentals.activity.scopePast', 'Past')}
              </ToggleButton>
              <ToggleButton value="all">
                {t('business.rentals.activity.scopeAll', 'All')}
              </ToggleButton>
            </ToggleButtonGroup>

            {(data?.bookings.length ?? 0) === 0 ? (
              <Typography color="text.secondary">
                {t('business.rentals.activity.empty', 'No rentals in this filter yet.')}
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {data?.bookings.map((row) => (
                  <ActivityBookingCard
                    key={row.id}
                    row={row}
                    language={i18n.language}
                    onOpen={() => navigate(`/rentals/bookings/${row.id}`)}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Box>
    </>
  );
};

function ActivityBookingCard({
  row,
  language,
  onOpen,
}: {
  row: BusinessRentalItemActivityBooking;
  language: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const client = row.rental_request?.client?.user;
  const name = [client?.first_name, client?.last_name].filter(Boolean).join(' ');
  const place = row.rental_location_listing?.business_location?.name;
  const amount = Number(row.total_amount) + Number(row.overtime_amount ?? 0);
  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, cursor: 'pointer' }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen();
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography fontWeight={700} noWrap sx={{ flex: 1, minWidth: 0 }}>
          {name || t('business.rentals.schedule.client', 'Client')}
        </Typography>
        <Chip size="small" label={row.status} />
      </Stack>
      {place ? (
        <Typography variant="body2" color="text.secondary" noWrap>
          {place}
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary">
        {formatDateTimeNoTimezone(row.start_at)} → {formatDateTimeNoTimezone(row.end_at)}
      </Typography>
      <Typography fontWeight={700}>
        {formatRequestAmount(amount, row.currency, language)}
      </Typography>
    </Paper>
  );
}

export default BusinessRentalItemActivityPage;
