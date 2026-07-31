import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PhoneInput from '../common/PhoneInput';
import {
  MobilePaymentPhone,
  parseE164Parts,
  useMobilePaymentPhones,
} from '../../hooks/useMobilePaymentPhones';

export type MobilePaymentPhoneModalMode = 'add' | 'edit' | 'verify';

interface MobilePaymentPhoneVerifyModalProps {
  open: boolean;
  mode: MobilePaymentPhoneModalMode;
  initialPhone?: MobilePaymentPhone | null;
  onClose: () => void;
  onCompleted?: (phone: MobilePaymentPhone) => void;
  attachAgentOnSuccess?: boolean;
}

type Step = 'form' | 'waiting' | 'success' | 'error';

export function MobilePaymentPhoneVerifyModal({
  open,
  mode,
  initialPhone,
  onClose,
  onCompleted,
  attachAgentOnSuccess = false,
}: MobilePaymentPhoneVerifyModalProps) {
  const { t } = useTranslation();
  const {
    createPhone,
    updatePhone,
    startVerification,
    pollUntilVerified,
    attachAgentPhone,
    fetchPhones,
  } = useMobilePaymentPhones(false);

  const initialParts = useMemo(
    () =>
      initialPhone ? parseE164Parts(initialPhone.phone_e164) : { countryCode: '237', phoneNumber: '' },
    [initialPhone]
  );

  const [countryCode, setCountryCode] = useState(initialParts.countryCode);
  const [phoneValue, setPhoneValue] = useState(
    initialPhone?.phone_e164 ?? ''
  );
  const [step, setStep] = useState<Step>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePhoneId, setActivePhoneId] = useState<string | null>(
    initialPhone?.id ?? null
  );

  useEffect(() => {
    if (!open) return;
    setStep('form');
    setError(null);
    setBusy(false);
    setActivePhoneId(initialPhone?.id ?? null);
    setPhoneValue(initialPhone?.phone_e164 ?? '');
    if (initialPhone) {
      const parts = parseE164Parts(initialPhone.phone_e164);
      setCountryCode(parts.countryCode);
    }
  }, [open, initialPhone]);

  const title =
    mode === 'edit'
      ? t('mobilePaymentPhone.editTitle', 'Edit mobile money number')
      : mode === 'verify'
        ? t('mobilePaymentPhone.verifyTitle', 'Verify mobile money number')
        : t('mobilePaymentPhone.addTitle', 'Add mobile money number');

  const handlePrimary = async () => {
    setError(null);
    setBusy(true);
    try {
      const digits = phoneValue.replace(/\D/g, '');
      const national = digits.startsWith(countryCode)
        ? digits.slice(countryCode.length)
        : digits.replace(/^237|^241/, '');

      let phone: MobilePaymentPhone;
      if (mode === 'edit' && initialPhone) {
        phone = await updatePhone(initialPhone.id, countryCode, national);
      } else if (mode === 'verify' && initialPhone) {
        phone = initialPhone;
      } else {
        phone = await createPhone(countryCode, national);
      }

      setActivePhoneId(phone.id);
      await startVerification(phone.id);
      setStep('waiting');

      const verified = await pollUntilVerified(phone.id);
      if (attachAgentOnSuccess) {
        await attachAgentPhone(verified.id);
      }
      await fetchPhones();
      setStep('success');
      onCompleted?.(verified);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          t('mobilePaymentPhone.genericError', 'Something went wrong. Please try again.')
      );
      setStep('error');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOnly = async () => {
    if (!initialPhone) return;
    setError(null);
    setBusy(true);
    try {
      await startVerification(initialPhone.id);
      setStep('waiting');
      const verified = await pollUntilVerified(initialPhone.id);
      if (attachAgentOnSuccess) {
        await attachAgentPhone(verified.id);
      }
      setStep('success');
      onCompleted?.(verified);
    } catch (e: any) {
      setError(e?.message || t('mobilePaymentPhone.genericError', 'Something went wrong.'));
      setStep('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {t(
              'mobilePaymentPhone.why',
              'We verify your number with a small 150 XAF mobile-money request so payouts reach the right wallet.'
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'mobilePaymentPhone.procedure',
              'You will receive a payment request for 150 XAF. Accept it with your PIN. We refund the full amount immediately after confirmation.'
            )}
          </Typography>
          {mode === 'edit' ? (
            <Alert severity="warning">
              {t(
                'mobilePaymentPhone.editWarning',
                'Changing this number will clear verification. You must verify again before payouts and product visibility resume.'
              )}
            </Alert>
          ) : null}

          {step === 'form' && mode !== 'verify' ? (
            <PhoneInput
              value={phoneValue}
              onChange={(v) => setPhoneValue(v ?? '')}
              onCountryChange={(iso2) => {
                if (iso2 === 'CM') setCountryCode('237');
                if (iso2 === 'GA') setCountryCode('241');
              }}
              onlyCountries={['CM', 'GA']}
              defaultCountry="CM"
              label={t('mobilePaymentPhone.phoneLabel', 'Mobile money number')}
              required
            />
          ) : null}

          {step === 'form' && mode === 'verify' && initialPhone ? (
            <Typography variant="body1">{initialPhone.phone_e164}</Typography>
          ) : null}

          {step === 'waiting' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <CircularProgress size={28} />
              <Typography variant="body2">
                {t(
                  'mobilePaymentPhone.waiting',
                  'Waiting for you to accept the request on your phone…'
                )}
              </Typography>
            </Box>
          ) : null}

          {step === 'success' ? (
            <Alert severity="success">
              {t(
                'mobilePaymentPhone.success',
                'Number verified. Refund of 150 XAF is on the way.'
              )}
            </Alert>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy && step === 'waiting'}>
          {step === 'success'
            ? t('common.close', 'Close')
            : t('common.cancel', 'Cancel')}
        </Button>
        {step === 'form' ? (
          <Button
            variant="contained"
            onClick={() =>
              mode === 'verify' ? void handleVerifyOnly() : void handlePrimary()
            }
            disabled={busy || (mode !== 'verify' && !phoneValue.trim())}
          >
            {mode === 'edit'
              ? t('mobilePaymentPhone.saveAndVerify', 'Save and verify')
              : t('mobilePaymentPhone.sendRequest', 'Send verification request')}
          </Button>
        ) : null}
        {step === 'error' ? (
          <Button variant="contained" onClick={() => setStep('form')}>
            {t('common.retry', 'Retry')}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
