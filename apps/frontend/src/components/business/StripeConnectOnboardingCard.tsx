import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStripeConnect } from '../../hooks/useStripeConnect';

const StripeConnectOnboardingCard: React.FC = () => {
  const { t } = useTranslation();
  const { status, loading, startOnboarding, openDashboard } = useStripeConnect();

  const isReady = !!status?.chargesEnabled && !!status?.payoutsEnabled;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
          <AccountBalanceWalletIcon color="primary" />
          <Typography variant="h6">
            {t('stripe.connect.title', 'Payouts with Stripe')}
          </Typography>
          {isReady && (
            <Chip
              icon={<CheckCircleIcon />}
              color="success"
              size="small"
              label={t('stripe.connect.active', 'Active')}
            />
          )}
        </Stack>

        <Typography variant="body2" color="text.secondary" mb={2}>
          {t(
            'stripe.connect.description',
            'Connect a Stripe account to receive payouts. A valid Stripe account also activates your business.'
          )}
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                color={status?.connected ? 'success' : 'default'}
                label={
                  status?.connected
                    ? t('stripe.connect.connected', 'Connected')
                    : t('stripe.connect.notConnected', 'Not connected')
                }
              />
              <Chip
                size="small"
                color={status?.payoutsEnabled ? 'success' : 'warning'}
                label={
                  status?.payoutsEnabled
                    ? t('stripe.connect.payoutsEnabled', 'Payouts enabled')
                    : t('stripe.connect.payoutsPending', 'Payouts pending')
                }
              />
            </Stack>

            <Stack direction="row" spacing={1.5}>
              {!isReady && (
                <Button variant="contained" onClick={startOnboarding}>
                  {status?.connected
                    ? t('stripe.connect.continueSetup', 'Continue setup')
                    : t('stripe.connect.setup', 'Set up payouts')}
                </Button>
              )}
              {status?.connected && (
                <Button
                  variant="outlined"
                  endIcon={<OpenInNewIcon />}
                  onClick={openDashboard}
                >
                  {t('stripe.connect.dashboard', 'Open Stripe dashboard')}
                </Button>
              )}
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default StripeConnectOnboardingCard;
