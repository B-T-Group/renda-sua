import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

/** Deep link back into the Rendasua mobile app after Stripe Connect onboarding. */
const APP_RETURN_URL = 'rendasua://connect/return';

interface ConnectOnboardingReturnPageProps {
  /** 'refresh' is used when Stripe needs a fresh onboarding link. */
  variant?: 'return' | 'refresh';
}

/**
 * Landing page Stripe redirects to after hosted Connect onboarding.
 * - Mobile (`?app=mobile`): bounces to the app via the `rendasua://` scheme so
 *   the in-app browser auth session closes and the app refreshes its status.
 * - Web: shows a short confirmation and routes back into the app.
 */
const ConnectOnboardingReturnPage: React.FC<ConnectOnboardingReturnPageProps> = ({
  variant = 'return',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = searchParams.get('app') === 'mobile';

  useEffect(() => {
    if (isMobile) {
      window.location.replace(APP_RETURN_URL);
    }
  }, [isMobile]);

  if (isMobile) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Paper sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography variant="h5">
              {t('stripe.connect.return.appTitle', 'Returning to the app')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'stripe.connect.return.appBody',
                'You can return to the Rendasua app. If it does not open automatically, tap the button below.'
              )}
            </Typography>
            <Button
              variant="contained"
              endIcon={<OpenInNewIcon />}
              href={APP_RETURN_URL}
            >
              {t('stripe.connect.return.openApp', 'Open the app')}
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  const isRefresh = variant === 'refresh';
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
        <Stack spacing={2} alignItems="center">
          <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
          <Typography variant="h5">
            {isRefresh
              ? t('stripe.connect.return.refreshTitle', 'Continue your setup')
              : t('stripe.connect.return.title', 'Stripe setup updated')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isRefresh
              ? t(
                  'stripe.connect.return.refreshBody',
                  'Your onboarding link expired. Return to your account to continue setting up payouts.'
                )
              : t(
                  'stripe.connect.return.body',
                  'We are syncing your Stripe account. It can take a moment for payouts to activate.'
                )}
          </Typography>
          <Box>
            <Button variant="contained" onClick={() => navigate('/app')}>
              {t('stripe.connect.return.continue', 'Continue')}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

export default ConnectOnboardingReturnPage;
