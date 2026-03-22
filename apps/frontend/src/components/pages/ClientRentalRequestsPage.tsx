import { Box, Button, Container, Typography } from '@mui/material';
import { gql } from 'graphql-request';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useRentalApi } from '../../hooks/useRentalApi';
import useGraphQLClient from '../../hooks/useGraphQLClient';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';

const MY_REQUESTS = gql`
  query MyRentalRequests {
    rental_requests(order_by: { created_at: desc }, limit: 30) {
      id
      status
      requested_start_at
      requested_end_at
      rental_location_listing {
        id
        rental_item {
          name
        }
      }
    }
  }
`;

const ClientRentalRequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const { client } = useGraphQLClient();
  const { createBooking } = useRentalApi();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const r = await client.request<{ rental_requests: any[] }>(MY_REQUESTS);
      setRows(r.rental_requests ?? []);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (isAuthenticated && client) void load();
  }, [isAuthenticated, client, load]);

  if (!isAuthenticated) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>{t('rentals.loginToViewRequests', 'Log in to view your requests')}</Typography>
      </Container>
    );
  }

  if (loading) {
    return <LoadingPage message={t('common.loading', 'Loading...')} showProgress />;
  }

  return (
    <>
      <SEOHead title={t('rentals.myRequests', 'My rental requests')} />
      <Container sx={{ py: 3 }}>
        <Typography variant="h5" gutterBottom>
          {t('rentals.myRequests', 'My rental requests')}
        </Typography>
        {rows.map((req) => (
          <Box key={req.id} sx={{ border: 1, borderColor: 'divider', p: 2, mb: 2 }}>
            <Typography variant="subtitle1">
              {req.rental_location_listing?.rental_item?.name}
            </Typography>
            <Typography variant="body2">
              {req.requested_start_at} → {req.requested_end_at}
            </Typography>
            <Typography>Status: {req.status}</Typography>
            {req.status === 'available' && (
              <Button
                sx={{ mt: 1 }}
                variant="contained"
                onClick={async () => {
                  const res = await createBooking(req.id);
                  navigate(`/rentals/bookings/${res.bookingId}`);
                }}
              >
                {t('rentals.bookNow', 'Book now')}
              </Button>
            )}
          </Box>
        ))}
        {rows.length === 0 && (
          <Typography color="text.secondary">
            {t('rentals.noRequests', 'No requests yet')}
          </Typography>
        )}
      </Container>
    </>
  );
};

export default ClientRentalRequestsPage;
