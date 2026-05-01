import { useAuth0 } from '@auth0/auth0-react';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { isValidPhoneNumber } from 'libphonenumber-js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import CountryPhoneNumberInput from '../common/CountryPhoneNumberInput';
import LoginMethodDialog from '../auth/LoginMethodDialog';
import {
  getDialCodeForActiveCountry,
  isActivePhoneCountry,
} from '../../constants/activeCountries';
import { useApiClient } from '../../hooks/useApiClient';
import { DETECTED_COUNTRY_STORAGE_KEY } from '../../hooks/useDetectedCountry';
import {
  SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_AUTH_REDIRECT,
  SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_CONTINUE_CLICK,
  SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_OPEN,
  SITE_EVENT_SUBJECT_INVENTORY_ITEM,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';

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
  /** Optional override for the primary CTA label (defaults to 'Continue'). */
  primaryCtaLabel?: string;
  /** Optional override for the cancel CTA label (defaults to 'Cancel'). */
  secondaryCtaLabel?: string;
  /** Opens login method chooser when secondary CTA is clicked. */
  openLoginDialogOnSecondaryCta?: boolean;
}

function isValidEmailFormat(email: string): boolean {
  const s = email.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

function normalizeCountryCode(input: string | null | undefined): string {
  return String(input || '')
    .trim()
    .toUpperCase();
}

function getApiErrorMessage(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const response = (err as { response?: { data?: { error?: string; message?: string } } })
    .response;
  return response?.data?.error || response?.data?.message;
}

const AnonymousBuyNowDialog: React.FC<AnonymousBuyNowDialogProps> = ({
  open,
  inventoryItemId,
  item,
  onClose,
  primaryCtaLabel,
  secondaryCtaLabel,
  openLoginDialogOnSecondaryCta = false,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const { loginWithRedirect } = useAuth0();
  const { trackSiteEvent } = useTrackSiteEvent();

  const [contactMethod, setContactMethod] = useState<'phone' | 'email'>('phone');
  const [email, setEmail] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('US');
  const [phoneNationalNumber, setPhoneNationalNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginMethodDialogOpen, setLoginMethodDialogOpen] = useState(false);
  const trackedOpenRef = useRef(false);

  const emailNormalized = useMemo(() => email.trim().toLowerCase(), [email]);
  const isEmailValid = useMemo(
    () => isValidEmailFormat(emailNormalized),
    [emailNormalized]
  );
  const phoneDialCode = useMemo(() => {
    const dial = getDialCodeForActiveCountry(phoneCountry);
    return dial ? `+${dial}` : '';
  }, [phoneCountry]);
  const phoneNumberDigits = useMemo(
    () => phoneNationalNumber.replace(/\D/g, ''),
    [phoneNationalNumber]
  );
  const phoneE164 = useMemo(() => {
    if (!phoneDialCode || !phoneNumberDigits) return '';
    return `${phoneDialCode}${phoneNumberDigits}`;
  }, [phoneDialCode, phoneNumberDigits]);
  const isPhoneValid = useMemo(() => {
    if (!phoneE164) return false;
    try {
      return isValidPhoneNumber(phoneE164);
    } catch {
      return false;
    }
  }, [phoneE164]);
  const firstNameTrimmed = useMemo(() => firstName.trim(), [firstName]);
  const lastNameTrimmed = useMemo(() => lastName.trim(), [lastName]);

  const returnToPathWithAnon = useMemo(
    () => `/items/${inventoryItemId}/place_order?anon=1`,
    [inventoryItemId]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const detected = normalizeCountryCode(
      localStorage.getItem(DETECTED_COUNTRY_STORAGE_KEY)
    );
    if (isActivePhoneCountry(detected)) {
      setPhoneCountry(detected);
    }
  }, []);

  const redirectToOtp = useCallback(
    async (
      screenHint: 'login' | 'signup',
      loginHint: string,
      connection: 'email' | 'sms'
    ) => {
      try {
        void trackSiteEvent({
          eventType: SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_AUTH_REDIRECT,
          subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
          subjectId: inventoryItemId,
          metadata: {
            screenHint,
            contactMethod,
            loginHint: loginHint || null,
            email: emailNormalized || null,
            phone: phoneE164 || null,
          },
        });
        await loginWithRedirect({
          authorizationParams: {
            connection,
            login_hint: loginHint,
            screen_hint: screenHint,
          },
          appState: { returnTo: returnToPathWithAnon },
        });
      } catch (redirectErr: unknown) {
        console.error('loginWithRedirect failed:', redirectErr);
        if (connection === 'email') {
          navigate('/auth/otp');
          return;
        }
        setError(
          t(
            'public.items.checkoutDialog.phoneAuthUnavailable',
            'Phone sign-in is currently unavailable. Please use email instead.'
          )
        );
      }
    },
    [
      contactMethod,
      emailNormalized,
      inventoryItemId,
      loginWithRedirect,
      navigate,
      phoneE164,
      returnToPathWithAnon,
      t,
      trackSiteEvent,
    ]
  );

  useEffect(() => {
    if (!open) {
      trackedOpenRef.current = false;
      return;
    }
    if (trackedOpenRef.current) return;
    trackedOpenRef.current = true;
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_OPEN,
      subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
      subjectId: inventoryItemId,
    });
  }, [inventoryItemId, open, trackSiteEvent]);

  const handleContinue = useCallback(async () => {
    if (submitting) return;
    if (contactMethod === 'email' && !isEmailValid) return;
    if (contactMethod === 'phone' && !isPhoneValid) return;
    if (!firstNameTrimmed || !lastNameTrimmed) return;
    setSubmitting(true);
    setError(null);
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_CONTINUE_CLICK,
      subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
      subjectId: inventoryItemId,
      metadata: {
        contactMethod,
        email: emailNormalized || null,
        phone: phoneE164 || null,
      },
    });
    try {
      if (contactMethod === 'phone') {
        const availability = await apiClient.get<{ taken: boolean }>(
          '/auth/phone-availability',
          { params: { phone_number: phoneE164 } }
        );
        if (availability.data?.taken) {
          await redirectToOtp('login', phoneE164, 'sms');
          return;
        }
        await apiClient.post('/auth/signup/start', {
          first_name: firstNameTrimmed,
          last_name: lastNameTrimmed,
          email: null,
          phone_number: phoneE164,
          personas: ['client'],
          user_type_id: 'client',
          profile: {},
        });
        await redirectToOtp('signup', phoneE164, 'sms');
        return;
      }

      const availability = await apiClient.get<{ taken: boolean }>(
        '/auth/email-availability',
        { params: { email: emailNormalized } }
      );

      if (availability.data?.taken) {
        await redirectToOtp('login', emailNormalized, 'email');
        return;
      }

      await apiClient.post('/auth/signup/start', {
        first_name: firstNameTrimmed,
        last_name: lastNameTrimmed,
        email: emailNormalized,
        phone_number: phoneE164 || null,
        personas: ['client'],
        user_type_id: 'client',
        profile: {},
      });

      await redirectToOtp('signup', emailNormalized, 'email');
    } catch (err: unknown) {
      const msg =
        getApiErrorMessage(err) ||
        t(
          'public.items.authCta.description',
          'Create an account to browse and order items.'
        );
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    apiClient,
    contactMethod,
    emailNormalized,
    firstNameTrimmed,
    inventoryItemId,
    isEmailValid,
    isPhoneValid,
    lastNameTrimmed,
    phoneE164,
    redirectToOtp,
    submitting,
    t,
    trackSiteEvent,
  ]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setError(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhoneNationalNumber('');
    setContactMethod('phone');
    onClose();
  }, [onClose, submitting]);

  const resolvedPrimaryCta = useMemo(
    () => primaryCtaLabel ?? t('public.items.checkoutDialog.continue', 'Continue'),
    [primaryCtaLabel, t]
  );

  const resolvedSecondaryCta = useMemo(
    () => secondaryCtaLabel ?? t('common.cancel', 'Cancel'),
    [secondaryCtaLabel, t]
  );

  const canSubmit =
    (contactMethod === 'email' ? isEmailValid : isPhoneValid) &&
    !!firstNameTrimmed &&
    !!lastNameTrimmed &&
    !submitting;

  const handleSecondaryAction = useCallback(() => {
    if (openLoginDialogOnSecondaryCta) {
      setLoginMethodDialogOpen(true);
      handleClose();
      return;
    }
    handleClose();
  }, [handleClose, openLoginDialogOnSecondaryCta]);

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="xs"
        fullScreen={fullScreen}
        slotProps={{
          paper: {
            sx: {
              borderRadius: fullScreen ? 0 : 3,
              overflow: 'hidden',
            },
          },
        }}
      >
        {/* Branded header */}
        <Box
          sx={{
            background: (th) =>
              `linear-gradient(135deg, ${th.palette.primary.dark} 0%, ${th.palette.primary.main} 100%)`,
            px: 3,
            pt: 3,
            pb: 2.5,
            position: 'relative',
          }}
        >
          <IconButton
            onClick={handleClose}
            disabled={submitting}
            size="small"
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              color: 'primary.contrastText',
              opacity: 0.7,
              '&:hover': { opacity: 1 },
            }}
          >
            <CloseRounded fontSize="small" />
          </IconButton>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingBagOutlined sx={{ color: 'primary.contrastText', fontSize: 20 }} />
          </Box>
          <Typography variant="h6" fontWeight={700} color="primary.contrastText" lineHeight={1.2}>
            {t('public.items.checkoutDialog.title', 'Continue to checkout')}
          </Typography>
        </Stack>

        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', maxWidth: 340 }}>
          {t(
            contactMethod === 'phone'
              ? 'public.items.checkoutDialog.subtitlePhone'
              : 'public.items.checkoutDialog.subtitleEmail',
            contactMethod === 'phone'
              ? 'Enter your name and phone number to continue. We’ll use them for your receipt, order updates, and to create your account.'
              : 'Enter your name and email to continue. We’ll use them for your receipt, order updates, and to create your account.'
          )}
        </Typography>
      </Box>

        <DialogContent sx={{ px: 2.5, pt: 2.5, pb: 1 }}>
          <Stack spacing={2}>
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* Item card */}
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'center',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
              p: 1.5,
              bgcolor: 'background.default',
            }}
          >
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: 2,
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
              ) : (
                <ShoppingBagOutlined sx={{ color: 'text.disabled', fontSize: 28 }} />
              )}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} noWrap>
                {item.title}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mt: 0.5 }}
                divider={<Divider orientation="vertical" flexItem />}
              >
                <Typography variant="body2" fontWeight={700} color="primary.main">
                  {item.priceText}
                </Typography>
                {item.quantity != null && (
                  <Typography variant="body2" color="text.secondary">
                    {t('orders.quantity', 'Qty')}: {item.quantity}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Box>

          {/* Name fields */}
          <Stack direction="row" spacing={1.5}>
            <TextField
              fullWidth
              label={t('public.items.checkoutDialog.firstNameLabel', 'First name')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              disabled={submitting}
              error={firstName.length > 0 && !firstNameTrimmed}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlined
                        fontSize="small"
                        sx={{ color: firstNameTrimmed ? 'primary.main' : 'text.disabled' }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              fullWidth
              label={t('public.items.checkoutDialog.lastNameLabel', 'Last name')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              disabled={submitting}
              error={lastName.length > 0 && !lastNameTrimmed}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlined
                        fontSize="small"
                        sx={{ color: lastNameTrimmed ? 'primary.main' : 'text.disabled' }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Stack>

          {contactMethod === 'phone' ? (
            <Stack spacing={1.5}>
              <CountryPhoneNumberInput
                countryCode={phoneCountry}
                onCountryCodeChange={setPhoneCountry}
                nationalNumber={phoneNationalNumber}
                onNationalNumberChange={setPhoneNationalNumber}
                countryLabel={t('public.items.checkoutDialog.phoneCountryLabel', 'Country code')}
                phoneLabel={t('public.items.checkoutDialog.phoneLabel', 'Phone number')}
                invalidPhoneMessage={t(
                  'public.items.checkoutDialog.phoneInvalid',
                  'Please enter a valid phone number.'
                )}
                isPhoneValid={isPhoneValid}
                disabled={submitting}
              />
              <Typography variant="caption" color="text.secondary">
                {t(
                  'public.items.checkoutDialog.phonePreview',
                  'We will use {{phone}} for account verification and order updates.',
                  { phone: phoneE164 || `${phoneDialCode}...` }
                )}
              </Typography>
            </Stack>
          ) : (
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
                  : undefined
              }
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlined
                        fontSize="small"
                        sx={{ color: isEmailValid ? 'primary.main' : 'text.disabled' }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          )}

          <Button
            variant="text"
            onClick={() =>
              setContactMethod((prev) => (prev === 'phone' ? 'email' : 'phone'))
            }
            disabled={submitting}
            sx={{
              alignSelf: 'center',
              textTransform: 'none',
              px: 0.25,
              minWidth: 0,
            }}
          >
            {contactMethod === 'phone'
              ? t(
                  'public.items.checkoutDialog.useEmailInstead',
                  'Enter email instead'
                )
              : t(
                  'public.items.checkoutDialog.usePhoneInstead',
                  'Enter phone number instead'
                )}
          </Button>

          {/* Trust badge */}
          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-start"
            sx={{
              borderRadius: 2,
              p: 1.5,
              bgcolor: (th) =>
                th.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.03)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <LockOutlined sx={{ fontSize: 16, color: 'success.main', mt: 0.25, flexShrink: 0 }} />
            <Box>
              <Typography variant="caption" fontWeight={700} display="block" color="text.primary">
                {t('public.items.checkoutDialog.trustTitle', 'No password needed')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(
                  contactMethod === 'phone'
                    ? 'public.items.checkoutDialog.trustBodyPhone'
                    : 'public.items.checkoutDialog.trustBodyEmail',
                  contactMethod === 'phone'
                    ? 'We’ll send a one-time code to your phone. You can pay with mobile money and track your order updates.'
                    : 'We’ll send a one-time code to your email. You can pay with mobile money and track your order updates.'
                )}
              </Typography>
            </Box>
          </Stack>

          {/* Primary CTA */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleContinue}
            disabled={!canSubmit}
            endIcon={
              submitting ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <ArrowForwardRounded />
              )
            }
            sx={{
              borderRadius: 2,
              py: 1.5,
              fontWeight: 700,
              fontSize: '0.9375rem',
              textTransform: 'none',
              boxShadow: canSubmit ? 4 : 0,
              transition: 'box-shadow 0.2s',
            }}
          >
            {submitting
              ? t('common.loading', 'Loading...')
              : resolvedPrimaryCta}
          </Button>

            <Button
              fullWidth
              onClick={handleSecondaryAction}
              disabled={submitting}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                color: 'text.secondary',
                mb: 0.5,
              }}
            >
              {resolvedSecondaryCta}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
      <LoginMethodDialog
        open={loginMethodDialogOpen}
        onClose={() => setLoginMethodDialogOpen(false)}
      />
    </>
  );
};

export default AnonymousBuyNowDialog;
