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

type Step = 'form' | 'question' | 'waiting' | 'success' | 'error';

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
    confirmVerification,
    pollUntilVerified,
    attachAgentPhone,
    fetchPhones,
    verificationMethod,
    loading: methodLoading,
    error: loadError,
  } = useMobilePaymentPhones(true);
  const methodReady = verificationMethod !== null;
  const isQuestion = verificationMethod === 'question';

  const initialParts = useMemo(
    () =>
      initialPhone
        ? parseE164Parts(initialPhone.phone_e164)
        : { countryCode: '237', phoneNumber: '' },
    [initialPhone]
  );

  const [countryCode, setCountryCode] = useState(initialParts.countryCode);
  const [phoneValue, setPhoneValue] = useState(initialPhone?.phone_e164 ?? '');
  const [activePhone, setActivePhone] = useState<MobilePaymentPhone | null>(
    initialPhone ?? null
  );
  const [step, setStep] = useState<Step>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !methodReady) return;
    setError(null);
    setBusy(false);
    setActivePhone(initialPhone ?? null);
    setPhoneValue(initialPhone?.phone_e164 ?? '');
    if (initialPhone) {
      const parts = parseE164Parts(initialPhone.phone_e164);
      setCountryCode(parts.countryCode);
    }
    setStep(mode === 'verify' && isQuestion ? 'question' : 'form');
  }, [open, initialPhone, mode, isQuestion, methodReady]);

  const title =
    mode === 'edit'
      ? t('mobilePaymentPhone.editTitle', 'Edit mobile money number')
      : mode === 'verify'
        ? t('mobilePaymentPhone.verifyTitle', 'Verify mobile money number')
        : t('mobilePaymentPhone.addTitle', 'Add mobile money number');

  const finishSuccess = async (verified: MobilePaymentPhone) => {
    if (attachAgentOnSuccess) {
      await attachAgentPhone(verified.id);
    }
    await fetchPhones();
    setStep('success');
    onCompleted?.(verified);
  };

  const resolvePhoneForForm = async (): Promise<MobilePaymentPhone> => {
    const digits = phoneValue.replace(/\D/g, '');
    const national = digits.startsWith(countryCode)
      ? digits.slice(countryCode.length)
      : digits.replace(/^237|^241/, '');
    if (mode === 'edit' && initialPhone) {
      return updatePhone(initialPhone.id, countryCode, national);
    }
    if (mode === 'add' && activePhone) {
      return updatePhone(activePhone.id, countryCode, national);
    }
    if (mode === 'verify' && initialPhone) return initialPhone;
    return createPhone(countryCode, national);
  };

  const runTransactionFlow = async (phone: MobilePaymentPhone) => {
    await startVerification(phone.id);
    setStep('waiting');
    const verified = await pollUntilVerified(phone.id);
    await finishSuccess(verified);
  };

  const handleFormContinue = async () => {
    setError(null);
    setBusy(true);
    try {
      const phone = await resolvePhoneForForm();
      setActivePhone(phone);
      if (isQuestion) {
        setStep('question');
        return;
      }
      await runTransactionFlow(phone);
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

  const handleConfirmYes = async () => {
    const phone = activePhone ?? initialPhone;
    if (!phone) return;
    setError(null);
    setBusy(true);
    try {
      const verified = await confirmVerification(phone.id);
      await finishSuccess(verified);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          t('mobilePaymentPhone.genericError', 'Something went wrong.')
      );
      setStep('error');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOnlyTransaction = async () => {
    if (!initialPhone) return;
    setError(null);
    setBusy(true);
    try {
      await runTransactionFlow(initialPhone);
    } catch (e: any) {
      setError(
        e?.message || t('mobilePaymentPhone.genericError', 'Something went wrong.')
      );
      setStep('error');
    } finally {
      setBusy(false);
    }
  };

  const displayNumber =
    activePhone?.phone_e164 ?? initialPhone?.phone_e164 ?? phoneValue;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {!methodReady && loadError ? (
          <Stack spacing={2} sx={{ py: 2 }} alignItems="center">
            <Alert severity="error">{loadError}</Alert>
            <Button variant="contained" onClick={() => void fetchPhones()}>
              {t('common.retry', 'Retry')}
            </Button>
          </Stack>
        ) : !methodReady || methodLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {step === 'form' ? (
            <>
              <Typography variant="body2" color="text.secondary">
                {isQuestion
                  ? t(
                      'mobilePaymentPhone.questionWhy',
                      'Confirm that this number is registered to receive Mobile Money so we can send your payouts there.'
                    )
                  : t(
                      'mobilePaymentPhone.why',
                      'We verify your number with a small 150 XAF mobile-money request so payouts reach the right wallet.'
                    )}
              </Typography>
              {!isQuestion ? (
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'mobilePaymentPhone.procedure',
                    'You will receive a payment request for 150 XAF. Accept it with your PIN. We refund the full amount immediately after confirmation.'
                  )}
                </Typography>
              ) : null}
              {mode === 'edit' ? (
                <Alert severity="warning">
                  {t(
                    'mobilePaymentPhone.editWarning',
                    'Changing this number will clear verification. You must verify again before payouts and product visibility resume.'
                  )}
                </Alert>
              ) : null}
              {mode !== 'verify' ? (
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
              {mode === 'verify' && initialPhone ? (
                <Typography variant="body1">{initialPhone.phone_e164}</Typography>
              ) : null}
            </>
          ) : null}

          {step === 'question' ? (
            <Stack spacing={1.5} alignItems="center" sx={{ py: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {displayNumber}
              </Typography>
              <Typography variant="body1" textAlign="center">
                {t(
                  'mobilePaymentPhone.questionPrompt',
                  'Can this number receive Mobile Money payments (MTN MoMo / Orange Money)?'
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {t(
                  'mobilePaymentPhone.questionHint',
                  'Only confirm if this wallet is yours and can accept transfers.'
                )}
              </Typography>
            </Stack>
          ) : null}

          {step === 'waiting' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <CircularProgress size={28} />
              <Typography variant="body2">
                {t(
                  'mobilePaymentPhone.waiting',
                  'Waiting for you to accept the request on your phoneù'
                )}
              </Typography>
            </Box>
          ) : null}

          {step === 'success' ? (
            <Alert severity="success">
              {isQuestion
                ? t(
                    'mobilePaymentPhone.questionSuccess',
                    'Number confirmed. You can use it for Mobile Money payouts.'
                  )
                : t(
                    'mobilePaymentPhone.success',
                    'Number verified. Refund of 150 XAF is on the way.'
                  )}
            </Alert>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        {!methodReady || methodLoading ? (
          <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
        ) : null}
        {methodReady && !methodLoading && step === 'question' ? (
          <>
            <Button onClick={onClose} disabled={busy}>
              {t('common.cancel', 'Cancel')}
            </Button>
            {mode !== 'verify' ? (
              <Button onClick={() => setStep('form')} disabled={busy}>
                {t(
                  'mobilePaymentPhone.questionNoDifferent',
                  'No, use a different number'
                )}
              </Button>
            ) : null}
            <Button
              variant="contained"
              onClick={() => void handleConfirmYes()}
              disabled={busy}
            >
              {t(
                'mobilePaymentPhone.questionYes',
                'Yes, it receives Mobile Money'
              )}
            </Button>
          </>
        ) : null}

        {methodReady && !methodLoading && step !== 'question' ? (
          <Button onClick={onClose} disabled={busy && step === 'waiting'}>
            {step === 'success'
              ? t('common.close', 'Close')
              : t('common.cancel', 'Cancel')}
          </Button>
        ) : null}

        {methodReady && !methodLoading && step === 'form' ? (
          <Button
            variant="contained"
            onClick={() =>
              void (mode === 'verify' && !isQuestion
                ? handleVerifyOnlyTransaction()
                : handleFormContinue())
            }
            disabled={busy || (mode !== 'verify' && !phoneValue.trim())}
          >
            {isQuestion
              ? t('mobilePaymentPhone.questionContinue', 'Continue')
              : mode === 'edit'
                ? t('mobilePaymentPhone.saveAndVerify', 'Save and verify')
                : t('mobilePaymentPhone.sendRequest', 'Send verification request')}
          </Button>
        ) : null}

        {methodReady && !methodLoading && step === 'error' ? (
          <Button
            variant="contained"
            onClick={() =>
              setStep(isQuestion && mode === 'verify' ? 'question' : 'form')
            }
          >
            {t('common.retry', 'Retry')}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
