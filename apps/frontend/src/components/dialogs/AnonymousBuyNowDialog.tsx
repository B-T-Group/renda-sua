import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';

interface CheckoutItemSummary {
  title: string;
  imageUrl?: string | null;
  priceText: string;
  quantity?: number;
}

export interface AnonymousBuyNowDialogProps {
  open: boolean;
  inventoryItemId: string;
  item: CheckoutItemSummary;
  onClose: () => void;
}

function isValidEmailFormat(email: string): boolean {
  const s = email.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

const AnonymousBuyNowDialog: React.FC<AnonymousBuyNowDialogProps> = ({
  open,
  inventoryItemId,
  item,
  onClose,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const { loginWithRedirect } = useAuth0();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailNormalized = useMemo(() => email.trim().toLowerCase(), [email]);
  const isEmailValid = useMemo(
    () => isValidEmailFormat(emailNormalized),
    [emailNormalized]
  );

  const returnTo = useMemo(
    () => `/items/${inventoryItemId}/place_order?anon=1`,
    [inventoryItemId]
  );

  const redirectToOtp = useCallback(
    async (screenHint: 'login' | 'signup') => {
      try {
        await loginWithRedirect({
          authorizationParams: {
            connection: 'email',
            login_hint: emailNormalized,
            screen_hint: screenHint,
          },
          appState: { returnTo },
        });
      } catch (redirectErr: any) {
        // Fallback: send to existing OTP page if Auth0 redirect fails
        console.error('loginWithRedirect failed:', redirectErr);
        navigate('/auth/otp');
      }
    },
    [emailNormalized, loginWithRedirect, navigate, returnTo]
  );

  const handleContinue = useCallback(async () => {
    if (!isEmailValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const availability = await apiClient.get<{ taken: boolean }>(
        '/auth/email-availability',
        { params: { email: emailNormalized } }
      );

      if (availability.data?.taken) {
        await redirectToOtp('login');
        return;
      }

      await apiClient.post('/auth/signup/start', {
        first_name: '',
        last_name: '',
        email: emailNormalized,
        phone_number: null,
        personas: ['client'],
        user_type_id: 'client',
        profile: {},
      });

      await redirectToOtp('signup');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t(
          'public.items.authCta.description',
          'Create an account to browse and order items.'
        );
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [apiClient, emailNormalized, isEmailValid, redirectToOtp, submitting, t]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setError(null);
    onClose();
  }, [onClose, submitting]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      fullScreen={fullScreen}
      slotProps={{ paper: { sx: { borderRadius: 0 } } }}
    >
      <DialogTitle sx={{ pb: 1.25 }}>
        {t('public.items.checkoutDialog.title', 'Continue to checkout')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="body2" color="text.secondary">
            {t(
              'public.items.checkoutDialog.subtitle',
              'Enter your email to continue. We’ll use it for your receipt, order updates, and to create your account.'
            )}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'center',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 1.25,
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 1.5,
                overflow: 'hidden',
                bgcolor: 'action.hover',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.imageUrl ? (
                <Box
                  component="img"
                  src={item.imageUrl}
                  alt={item.title}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : null}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} noWrap>
                {item.title}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mt: 0.25 }}
                divider={<Divider orientation="vertical" flexItem />}
              >
                <Typography variant="body2" fontWeight={700}>
                  {item.priceText}
                </Typography>
                {item.quantity != null && (
                  <Typography variant="body2" color="text.secondary">
                    {t('orders.quantity', 'Quantity')}: {item.quantity}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Box>

          <TextField
            fullWidth
            label={t('public.items.checkoutDialog.emailLabel', 'Email address')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={submitting}
            error={email.length > 0 && !isEmailValid}
            helperText={
              email.length > 0 && !isEmailValid
                ? t('signupPage.emailInvalid', 'Please enter a valid email.')
                : t(
                    'public.items.checkoutDialog.noPasswordHelper',
                    'No password needed, we will send you a one time code.'
                  )
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={submitting} sx={{ borderRadius: 0 }}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleContinue}
          disabled={!isEmailValid || submitting}
          sx={{ borderRadius: 0 }}
        >
          {submitting
            ? t('common.loading', 'Loading...')
            : t('public.items.checkoutDialog.continue', 'Continue')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AnonymousBuyNowDialog;

