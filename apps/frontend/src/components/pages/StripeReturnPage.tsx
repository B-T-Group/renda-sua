import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStripePayments } from '../../hooks/useStripePayments';

type ResultState = 'pending' | 'success' | 'failed' | 'cancelled';

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 12;

const StripeReturnPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkStatusByReference } = useStripePayments();

  const reference = searchParams.get('reference') ?? '';
  const initialStatus = searchParams.get('status');
  const [state, setState] = useState<ResultState>(
    initialStatus === 'cancel' ? 'cancelled' : 'pending'
  );
  const pollsRef = useRef(0);

  const poll = useCallback(async () => {
    if (!reference) return;
    const result = await checkStatusByReference(reference);
    if (result && result.status !== 'pending') {
      setState(result.status as ResultState);
    }
  }, [reference, checkStatusByReference]);

  useEffect(() => {
    if (state !== 'pending' || !reference) return;
    const interval = setInterval(() => {
      pollsRef.current += 1;
      if (pollsRef.current > MAX_POLLS) {
        clearInterval(interval);
        return;
      }
      void poll();
    }, POLL_INTERVAL_MS);
    void poll();
    return () => clearInterval(interval);
  }, [state, reference, poll]);

  const isSuccess = state === 'success';
  const isPending = state === 'pending';

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
        <Stack spacing={2} alignItems="center">
          {isPending && <CircularProgress />}
          {isSuccess && (
            <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
          )}
          {!isPending && !isSuccess && (
            <CancelIcon color="error" sx={{ fontSize: 64 }} />
          )}

          <Typography variant="h5">
            {isPending
              ? t('stripe.return.pendingTitle', 'Confirming your payment')
              : isSuccess
              ? t('stripe.return.successTitle', 'Payment successful')
              : t('stripe.return.failedTitle', 'Payment not completed')}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            {isPending
              ? t(
                  'stripe.return.pendingBody',
                  'Please wait while we confirm your payment with Stripe.'
                )
              : isSuccess
              ? t(
                  'stripe.return.successBody',
                  'Your payment was received. Thank you!'
                )
              : t(
                  'stripe.return.failedBody',
                  'Your payment was not completed. You can try again.'
                )}
          </Typography>

          <Box>
            <Button variant="contained" onClick={() => navigate('/app')}>
              {t('stripe.return.continue', 'Continue')}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

export default StripeReturnPage;
