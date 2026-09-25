import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
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
import {
  nationalDigitsForMobilePayment,
  resolveMobilePaymentPhoneFormAction,
} from '../../utils/resolveMobilePaymentPhoneFormAction';

export type MobilePaymentPhoneModalMode = 'add' | 'edit' | 'verify';

interface MobilePaymentPhoneVerifyModalProps {
  open: boolean;
  mode: MobilePaymentPhoneModalMode;
  initialPhone?: MobilePaymentPhone | null;
  onClose: () => void;
  onCompleted?: (phone: MobilePaymentPhone) => void;
  attachAgentOnSuccess?: boolean;
}

type Step = 'choose' | 'form' | 'question' | 'waiting' | 'success' | 'error';

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
    phones,
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
  const [preferNew, setPreferNew] = useState(false);
  const [selectedExisting, setSelectedExisting] = useState(false);

  useEffect(() => {
    if (!open || !methodReady) return;
    setError(null);
    setBusy(false);
    setPreferNew(false);
    setSelectedExisting(false);
    setActivePhone(initialPhone ?? null);
    setPhoneValue(initialPhone?.phone_e164 ?? '');
    if (initialPhone) {
      setCountryCode(parseE164Parts(initialPhone.phone_e164).countryCode);
    }
    setStep(mode === 'verify' && isQuestion ? 'question' : 'form');
  }, [open, initialPhone, mode, isQuestion, methodReady]);

  useEffect(() => {
    if (!open || mode !== 'add' || initialPhone || preferNew) return;
    if (phones.length === 0) return;
    setStep((current) => (current === 'form' ? 'choose' : current));
  }, [open, mode, initialPhone, preferNew, phones.length]);

  const title = modalTitle(t, mode, step);

  const finishSuccess = async (verified: MobilePaymentPhone) => {
    if (attachAgentOnSuccess) {
      await attachAgentPhone(verified.id);
    }
    await fetchPhones();
    setStep('success');
    onCompleted?.(verified);
  };

  const beginAddNewNumber = () => {
    setPreferNew(true);
    setSelectedExisting(false);
    setActivePhone(null);
    setPhoneValue('');
    setStep('form');
  };

  const resolvePhoneForForm = async (): Promise<MobilePaymentPhone> => {
    const national = nationalDigitsForMobilePayment(phoneValue, countryCode);
    const action = resolveMobilePaymentPhoneFormAction({
      mode,
      mustCreateNew: preferNew || selectedExisting,
      activePhoneId: activePhone?.id,
      initialPhoneId: initialPhone?.id,
    });
    if (action.type === 'update') {
      return updatePhone(action.phoneId, countryCode, national);
    }
    if (action.type === 'reuse' && initialPhone) return initialPhone;
    return createPhone(countryCode, national);
  };

  const runTransactionFlow = async (phone: MobilePaymentPhone) => {
    await startVerification(phone.id);
    setStep('waiting');
    const verified = await pollUntilVerified(phone.id);
    await finishSuccess(verified);
  };

  const selectExisting = async (phone: MobilePaymentPhone) => {
    setError(null);
    setBusy(true);
    setSelectedExisting(true);
    setPreferNew(false);
    setActivePhone(phone);
    try {
      if (phone.is_verified) {
        await finishSuccess(phone);
        return;
      }
      if (isQuestion) {
        setStep('question');
        return;
      }
      await runTransactionFlow(phone);
    } catch (e: any) {
      setError(errorMessage(e, t));
      setStep('error');
    } finally {
      setBusy(false);
    }
  };

  const handleFormContinue = async () => {
    setError(null);
    setBusy(true);
    try {
      const phone = await resolvePhoneForForm();
      setActivePhone(phone);
      setPreferNew(false);
      setSelectedExisting(false);
      if (isQuestion) {
        setStep('question');
        return;
      }
      await runTransactionFlow(phone);
    } catch (e: any) {
      setError(errorMessage(e, t));
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
      setError(errorMessage(e, t));
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
      setError(errorMessage(e, t));
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
            {step === 'choose' ? (
              <ChooseExistingPhones
                phones={phones}
                busy={busy}
                onSelect={(phone) => void selectExisting(phone)}
                onAddNew={beginAddNewNumber}
              />
            ) : null}
            {step === 'form' ? (
              <PhoneFormStep
                mode={mode}
                isQuestion={isQuestion}
                phoneValue={phoneValue}
                initialPhone={initialPhone}
                canGoBackToChoose={mode === 'add' && phones.length > 0}
                onPhoneChange={setPhoneValue}
                onCountryIso={(iso2) => {
                  if (iso2 === 'CM') setCountryCode('237');
                  if (iso2 === 'GA') setCountryCode('241');
                }}
                onBackToChoose={() => {
                  setPreferNew(false);
                  setSelectedExisting(false);
                  setStep('choose');
                }}
              />
            ) : null}
            {step === 'question' ? (
              <QuestionStep displayNumber={displayNumber} />
            ) : null}
            {step === 'waiting' ? <WaitingStep /> : null}
            {step === 'success' ? <SuccessAlert isQuestion={isQuestion} /> : null}
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        )}
      </DialogContent>
      <ModalActions
        methodReady={methodReady}
        methodLoading={methodLoading}
        step={step}
        mode={mode}
        busy={busy}
        isQuestion={isQuestion}
        phoneValue={phoneValue}
        onClose={onClose}
        onBackToForm={() =>
          selectedExisting ? beginAddNewNumber() : setStep('form')
        }
        onConfirmYes={() => void handleConfirmYes()}
        onFormContinue={() =>
          void (mode === 'verify' && !isQuestion
            ? handleVerifyOnlyTransaction()
            : handleFormContinue())
        }
        onRetry={() =>
          setStep(isQuestion && mode === 'verify' ? 'question' : mode === 'add' && phones.length ? 'choose' : 'form')
        }
      />
    </Dialog>
  );
}

function modalTitle(
  t: (key: string, fallback: string) => string,
  mode: MobilePaymentPhoneModalMode,
  step: Step
): string {
  if (step === 'choose') {
    return t('mobilePaymentPhone.linkTitle', 'Link mobile money number');
  }
  if (mode === 'edit') {
    return t('mobilePaymentPhone.editTitle', 'Edit mobile money number');
  }
  if (mode === 'verify') {
    return t('mobilePaymentPhone.verifyTitle', 'Verify mobile money number');
  }
  return t('mobilePaymentPhone.addTitle', 'Add mobile money number');
}

function errorMessage(
  e: { response?: { data?: { message?: string } }; message?: string },
  t: (key: string, fallback: string) => string
): string {
  return (
    e?.response?.data?.message ||
    e?.message ||
    t('mobilePaymentPhone.genericError', 'Something went wrong. Please try again.')
  );
}

function ChooseExistingPhones({
  phones,
  busy,
  onSelect,
  onAddNew,
}: {
  phones: MobilePaymentPhone[];
  busy: boolean;
  onSelect: (phone: MobilePaymentPhone) => void;
  onAddNew: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        {t(
          'mobilePaymentPhone.chooseExisting',
          'Choose a number you already added, or add a new one for this location.'
        )}
      </Typography>
      <List disablePadding sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
        {phones.map((phone) => (
          <ListItemButton
            key={phone.id}
            disabled={busy}
            onClick={() => onSelect(phone)}
            sx={{ borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
          >
            <ListItemText
              primary={phone.phone_e164}
              secondary={
                phone.is_verified
                  ? t('mobilePaymentPhone.verified', 'Verified')
                  : t(
                      'mobilePaymentPhone.needsConfirm',
                      'Unverified ? confirm to use'
                    )
              }
            />
          </ListItemButton>
        ))}
      </List>
      <Button variant="outlined" onClick={onAddNew} disabled={busy}>
        {t('mobilePaymentPhone.addNew', 'Add new number?')}
      </Button>
    </Stack>
  );
}

function PhoneFormStep({
  mode,
  isQuestion,
  phoneValue,
  initialPhone,
  canGoBackToChoose,
  onPhoneChange,
  onCountryIso,
  onBackToChoose,
}: {
  mode: MobilePaymentPhoneModalMode;
  isQuestion: boolean;
  phoneValue: string;
  initialPhone?: MobilePaymentPhone | null;
  canGoBackToChoose: boolean;
  onPhoneChange: (value: string) => void;
  onCountryIso: (iso2: string) => void;
  onBackToChoose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {canGoBackToChoose ? (
        <Button size="small" onClick={onBackToChoose} sx={{ alignSelf: 'flex-start' }}>
          {t('mobilePaymentPhone.backToExisting', 'Back to existing numbers')}
        </Button>
      ) : null}
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
          onChange={(v) => onPhoneChange(v ?? '')}
          onCountryChange={onCountryIso}
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
  );
}

function QuestionStep({ displayNumber }: { displayNumber: string }) {
  const { t } = useTranslation();
  return (
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
  );
}

function WaitingStep() {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
      <CircularProgress size={28} />
      <Typography variant="body2">
        {t(
          'mobilePaymentPhone.waiting',
          'Waiting for you to accept the request on your phone'
        )}
      </Typography>
    </Box>
  );
}

function SuccessAlert({ isQuestion }: { isQuestion: boolean }) {
  const { t } = useTranslation();
  return (
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
  );
}

function ModalActions({
  methodReady,
  methodLoading,
  step,
  mode,
  busy,
  isQuestion,
  phoneValue,
  onClose,
  onBackToForm,
  onConfirmYes,
  onFormContinue,
  onRetry,
}: {
  methodReady: boolean;
  methodLoading: boolean;
  step: Step;
  mode: MobilePaymentPhoneModalMode;
  busy: boolean;
  isQuestion: boolean;
  phoneValue: string;
  onClose: () => void;
  onBackToForm: () => void;
  onConfirmYes: () => void;
  onFormContinue: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  if (!methodReady || methodLoading) {
    return (
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
      </DialogActions>
    );
  }
  return (
    <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
      {step === 'choose' ? (
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel', 'Cancel')}
        </Button>
      ) : null}
      {step === 'question' ? (
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel', 'Cancel')}
          </Button>
          {mode !== 'verify' ? (
            <Button onClick={onBackToForm} disabled={busy}>
              {t('mobilePaymentPhone.questionNoDifferent', 'No, use a different number')}
            </Button>
          ) : null}
          <Button variant="contained" onClick={onConfirmYes} disabled={busy}>
            {t('mobilePaymentPhone.questionYes', 'Yes, it receives Mobile Money')}
          </Button>
        </>
      ) : null}
      {step !== 'question' && step !== 'choose' ? (
        <Button onClick={onClose} disabled={busy && step === 'waiting'}>
          {step === 'success'
            ? t('common.close', 'Close')
            : t('common.cancel', 'Cancel')}
        </Button>
      ) : null}
      {step === 'form' ? (
        <Button
          variant="contained"
          onClick={onFormContinue}
          disabled={busy || (mode !== 'verify' && !phoneValue.trim())}
        >
          {isQuestion
            ? t('mobilePaymentPhone.questionContinue', 'Continue')
            : mode === 'edit'
              ? t('mobilePaymentPhone.saveAndVerify', 'Save and verify')
              : t('mobilePaymentPhone.sendRequest', 'Send verification request')}
        </Button>
      ) : null}
      {step === 'error' ? (
        <Button variant="contained" onClick={onRetry}>
          {t('common.retry', 'Retry')}
        </Button>
      ) : null}
    </DialogActions>
  );
}
