import {
  Alert,
  Box,
  Button,
  Container,
  TextField,
  Typography,
} from '@mui/material';
import { gql } from 'graphql-request';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { RentalListingRow } from '../../hooks/useRentalListings';
import { useRentalApi } from '../../hooks/useRentalApi';
import useGraphQLClient from '../../hooks/useGraphQLClient';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';

const ONE_LISTING = gql`
  query RentalListingOne($id: uuid!) {
    rental_location_listings_by_pk(id: $id) {
      id
      base_price_per_day
      min_rental_days
      max_rental_days
      pickup_instructions
      dropoff_instructions
      rental_item {
        id
        name
        description
        tags
        currency
        operation_mode
        rental_category {
          name
        }
        rental_item_images(order_by: { display_order: asc }) {
          image_url
          alt_text
        }
        business {
          name
        }
      }
      business_location {
        name
        address {
          city
          country
        }
      }
    }
  }
`;

const RentalListingDetailPage: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const { baseClient, client } = useGraphQLClient();
  const { createRequest } = useRentalApi();
  const [row, setRow] = useState<RentalListingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    setError(null);
    try {
      const gqlClient = isAuthenticated && client ? client : baseClient;
      const res = await gqlClient.request<{
        rental_location_listings_by_pk: RentalListingRow | null;
      }>(ONE_LISTING, { id: listingId });
      setRow(res.rental_location_listings_by_pk);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [listingId, baseClient, client, isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitRequest = async () => {
    setMsg(null);
    if (!listingId || !start || !end) {
      setMsg(t('rentals.fillDates', 'Choose start and end'));
      return;
    }
    try {
      const isoStart = new Date(start).toISOString();
      const isoEnd = new Date(end).toISOString();
      await createRequest({
        rentalLocationListingId: listingId,
        requestedStartAt: isoStart,
        requestedEndAt: isoEnd,
      });
      setMsg(t('rentals.requestSent', 'Request sent. The business will respond.'));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setMsg(
        err?.response?.data?.message ||
          (e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'))
      );
    }
  };

  if (loading || !listingId) {
    return (
      <LoadingPage
        message={t('common.loading', 'Loading...')}
        showProgress
      />
    );
  }

  if (!row) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>{t('rentals.notFound', 'Listing not found')}</Typography>
      </Container>
    );
  }

  return (
    <>
      <SEOHead title={row.rental_item.name} />
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography variant="h4" gutterBottom>
          {row.rental_item.name}
        </Typography>
        <Typography color="text.secondary" gutterBottom>
          {row.rental_item.business.name} · {row.business_location.name}
        </Typography>
        <Typography variant="body1" sx={{ my: 2 }}>
          {row.rental_item.description}
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          {t(
            'rentals.businessOperatedNotice',
            'All rentals are operated by the business (you do not take equipment home unattended).'
          )}
        </Alert>
        <Typography variant="subtitle1">
          {t('rentals.category', 'Category')}: {row.rental_item.rental_category.name}
        </Typography>
        <Typography>
          {row.base_price_per_day} {row.rental_item.currency}{' '}
          {t('rentals.perDay', '/ day')} · {t('rentals.minDays', 'Min days')}:{' '}
          {row.min_rental_days}
          {row.max_rental_days != null
            ? ` · ${t('rentals.maxDays', 'Max days')}: ${row.max_rental_days}`
            : ''}
        </Typography>
        <Box sx={{ my: 2 }}>
          <Typography variant="subtitle2">
            {t('rentals.pickupInstructions', 'Pickup / service instructions')}
          </Typography>
          <Typography variant="body2">{row.pickup_instructions || '—'}</Typography>
        </Box>
        <Box sx={{ my: 2 }}>
          <Typography variant="subtitle2">
            {t('rentals.dropoffInstructions', 'Return instructions')}
          </Typography>
          <Typography variant="body2">{row.dropoff_instructions || '—'}</Typography>
        </Box>

        {isAuthenticated ? (
          <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
            <Typography variant="h6">
              {t('rentals.requestRental', 'Request this rental')}
            </Typography>
            <TextField
              label={t('rentals.start', 'Start')}
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('rentals.end', 'End')}
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="contained" onClick={() => void submitRequest()}>
              {t('rentals.submitRequest', 'Submit request')}
            </Button>
            {msg && (
              <Alert severity={msg.includes('sent') ? 'success' : 'error'}>{msg}</Alert>
            )}
            <Button sx={{ mt: 1 }} onClick={() => navigate('/rentals/requests')}>
              {t('rentals.myRequests', 'My rental requests')}
            </Button>
          </Box>
        ) : (
          <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate('/app')}>
            {t('rentals.loginToRequest', 'Log in to request')}
          </Button>
        )}
      </Container>
    </>
  );
};

export default RentalListingDetailPage;
