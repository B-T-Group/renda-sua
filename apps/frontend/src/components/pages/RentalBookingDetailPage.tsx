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
import { useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useRentalApi } from '../../hooks/useRentalApi';
import useGraphQLClient from '../../hooks/useGraphQLClient';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';

const BOOKING_Q = gql`
  query RentalBookingDetail($id: uuid!) {
    rental_bookings_by_pk(id: $id) {
      id
      status
      start_at
      end_at
      total_amount
      currency
      client_id
      business_id
      rental_location_listing {
        rental_item {
          name
        }
        business_location {
          name
        }
      }
      rental_hold {
        client_hold_amount
        status
      }
    }
  }
`;

const RentalBookingDetailPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth0();
  const { client } = useGraphQLClient();
  const { profile } = useUserProfileContext();
  const api = useRentalApi();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [ow, setOw] = useState('');
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bookingId || !client) return;
    setLoading(true);
    try {
      const res = await client.request<{ rental_bookings_by_pk: any }>(BOOKING_Q, {
        id: bookingId,
      });
      setBooking(res.rental_bookings_by_pk);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [bookingId, client]);

  useEffect(() => {
    if (isAuthenticated && client) void load();
  }, [load, isAuthenticated, client]);

  const isClient = profile?.client?.id === booking?.client_id;
  const isBusiness = profile?.business?.id === booking?.business_id;

  if (!isAuthenticated) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="info">
          {t('rentals.loginToViewBooking', 'Log in to view this booking')}
        </Alert>
      </Container>
    );
  }

  if (loading || !bookingId) {
    return <LoadingPage message={t('common.loading', 'Loading...')} showProgress />;
  }

  if (!booking) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>{t('rentals.bookingNotFound', 'Booking not found')}</Typography>
      </Container>
    );
  }

  const title = booking.rental_location_listing?.rental_item?.name ?? 'Rental';

  return (
    <>
      <SEOHead title={title} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Typography variant="h5" gutterBottom>
          {title}
        </Typography>
        <Typography color="text.secondary">
          {booking.rental_location_listing?.business_location?.name}
        </Typography>
        <Typography sx={{ mt: 1 }}>
          {t('rentals.status', 'Status')}: <strong>{booking.status}</strong>
        </Typography>
        <Typography variant="body2">
          {booking.start_at} → {booking.end_at}
        </Typography>
        <Typography>
          {booking.total_amount} {booking.currency}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {info && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {info}
          </Alert>
        )}

        {isClient && booking.status === 'confirmed' && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              variant="contained"
              onClick={async () => {
                try {
                  const r = await api.getStartPin(bookingId);
                  setInfo(`${t('rentals.yourPin', 'Your start PIN')}: ${r.pin}`);
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Error');
                }
              }}
            >
              {t('rentals.showStartPin', 'Show start PIN')}
            </Button>
            <Button
              color="warning"
              onClick={async () => {
                try {
                  await api.cancelBooking(bookingId);
                  setInfo(t('rentals.cancelled', 'Booking cancelled'));
                  void load();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Error');
                }
              }}
            >
              {t('rentals.cancelBooking', 'Cancel booking')}
            </Button>
          </Box>
        )}

        {isBusiness && booking.status === 'confirmed' && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              label={t('rentals.clientPin', 'Client PIN')}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <TextField
              label={t('rentals.overwriteCode', 'Overwrite code')}
              value={ow}
              onChange={(e) => setOw(e.target.value)}
            />
            <Button
              variant="contained"
              onClick={async () => {
                try {
                  await api.verifyStartPin(bookingId, {
                    pin: pin || undefined,
                    overwriteCode: ow || undefined,
                  });
                  setInfo(t('rentals.started', 'Rental started'));
                  void load();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Error');
                }
              }}
            >
              {t('rentals.verifyStart', 'Verify start')}
            </Button>
            <Button
              onClick={async () => {
                try {
                  const r = await api.generateOverwrite(bookingId);
                  setInfo(`${t('rentals.overwrite', 'Overwrite')}: ${r.overwriteCode}`);
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Error');
                }
              }}
            >
              {t('rentals.genOverwrite', 'Generate overwrite code')}
            </Button>
          </Box>
        )}

        {isBusiness && booking.status === 'awaiting_return' && (
          <Button
            sx={{ mt: 2 }}
            variant="contained"
            color="success"
            onClick={async () => {
              try {
                await api.confirmReturn(bookingId);
                setInfo(t('rentals.completed', 'Completed and settled'));
                void load();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Error');
              }
            }}
          >
            {t('rentals.confirmReturn', 'Confirm return')}
          </Button>
        )}
      </Container>
    </>
  );
};

export default RentalBookingDetailPage;
