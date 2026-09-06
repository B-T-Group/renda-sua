import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from 'libphonenumber-js';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PhoneNumberInput from '../PhoneNumberInput';
import { MobileMoneyConfirmIllustration } from '../illustrations/MobileMoneyConfirmIllustration';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobilePaymentPhones } from '../../hooks/useMobilePaymentPhones';
import {
  mobilePaymentPhonesApi,
  parseE164Parts,
} from '../../services/mobilePaymentPhonesApi';
import type {
  MobilePaymentPhone,
  MobilePaymentPhoneModalMode,
  MobilePaymentPhoneSummary,
} from '../../types/mobilePaymentPhone';
import { nationalDigitsToE164 } from '../../utils/phoneLoginUsername';

type Step = 'form' | 'question' | 'waiting' | 'success' | 'error';

export interface MobilePaymentPhoneVerifyModalProps {
  visible: boolean;
  mode: MobilePaymentPhoneModalMode;
  initialPhone?: MobilePaymentPhoneSummary | null;
  attachAgentOnSuccess?: boolean;
  onDismiss: () => void;
  onCompleted?: (phone: MobilePaymentPhone) => void;
}

export function MobilePaymentPhoneVerifyModal({
  visible,
  mode,
  initialPhone,
  attachAgentOnSuccess = false,
  onDismiss,
  onCompleted,
}: MobilePaymentPhoneVerifyModalProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { pollUntilVerified, fetchPhones, verificationMethod, loading: methodLoading, error: loadError } =
    useMobilePaymentPhones(true);
  const methodReady = verificationMethod !== null;
  const isQuestion = verificationMethod === 'question';

  const [countryIso, setCountryIso] = useState<CountryCode>('CM');
  const [nationalDigits, setNationalDigits] = useState('');
  const [activePhone, setActivePhone] = useState<MobilePaymentPhoneSummary | null>(
    initialPhone ?? null
  );
  const [step, setStep] = useState<Step>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !methodReady) return;
    setError(null);
    setBusy(false);
    setActivePhone(initialPhone ?? null);
    if (initialPhone) {
      const parts = parseE164Parts(initialPhone.phone_e164);
      setCountryIso(parts.countryCode === '241' ? 'GA' : 'CM');
      setNationalDigits(parts.phoneNumber);
    } else {
      setCountryIso('CM');
      setNationalDigits('');
    }
    setStep(mode === 'verify' && isQuestion ? 'question' : 'form');
  }, [visible, initialPhone, mode, isQuestion, methodReady]);

  const title =
    mode === 'edit'
      ? t('mobilePaymentPhone.editTitle', 'Edit mobile money number')
      : mode === 'verify'
        ? t('mobilePaymentPhone.verifyTitle', 'Verify mobile money number')
        : t('mobilePaymentPhone.addTitle', 'Add mobile money number');

  const finishSuccess = async (verified: MobilePaymentPhone) => {
    if (attachAgentOnSuccess) {
      await mobilePaymentPhonesApi.attachAgent(verified.id);
    }
    await fetchPhones();
    setStep('success');
    onCompleted?.(verified);
  };

  const resolvePhoneForForm = async (): Promise<MobilePaymentPhoneSummary> => {
    const cc = countryIso === 'GA' ? '241' : '237';
    if (mode === 'edit' && initialPhone) {
      return (await mobilePaymentPhonesApi.update(initialPhone.id, cc, nationalDigits))
        .data.phone;
    }
    if (mode === 'add' && activePhone) {
      return (await mobilePaymentPhonesApi.update(activePhone.id, cc, nationalDigits))
        .data.phone;
    }
    if (mode === 'add') {
      return (await mobilePaymentPhonesApi.create(cc, nationalDigits)).data.phone;
    }
    if (initialPhone) return initialPhone;
    throw new Error('Missing phone');
  };

  const runTransactionVerification = async (phone: MobilePaymentPhoneSummary) => {
    await mobilePaymentPhonesApi.verify(phone.id);
    setStep('waiting');
    const verified = await pollUntilVerified(phone.id);
    await finishSuccess(verified);
  };

  const runQuestionConfirm = async (phone: MobilePaymentPhoneSummary) => {
    const verified = (await mobilePaymentPhonesApi.confirm(phone.id)).data.phone;
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
      await runTransactionVerification(phone);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : t('mobilePaymentPhone.genericError', 'Something went wrong. Please try again.')
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
      await runQuestionConfirm(phone);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : t('mobilePaymentPhone.genericError', 'Something went wrong.')
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
      await runTransactionVerification(initialPhone);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : t('mobilePaymentPhone.genericError', 'Something went wrong.')
      );
      setStep('error');
    } finally {
      setBusy(false);
    }
  };

  const canSubmitForm =
    mode === 'verify'
      ? !!initialPhone
      : !!nationalDigitsToE164(countryIso, nationalDigits);
  const displayNumber =
    activePhone?.phone_e164 ??
    initialPhone?.phone_e164 ??
    nationalDigitsToE164(countryIso, nationalDigits) ??
    '';
  const waitingLocked = busy && step === 'waiting';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={waitingLocked ? undefined : onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={waitingLocked ? undefined : onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.88,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="titleLarge" style={{ color: colors.text.primary, padding: spacing.md }}>
            {title}
          </Text>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.md,
              paddingBottom: spacing.md,
            }}
          >
            {!methodReady && loadError ? (
              <View style={{ gap: spacing.sm, paddingVertical: spacing.md }}>
                <Text variant="bodyMedium" style={{ color: colors.error.main }}>
                  {loadError}
                </Text>
                <Button mode="contained" onPress={() => void fetchPhones()}>
                  {t('common.retry', 'Retry')}
                </Button>
              </View>
            ) : !methodReady || methodLoading ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.lg,
                }}
              >
                <ActivityIndicator />
                <Text variant="bodyMedium">
                  {t('common.loading', 'Loading?')}
                </Text>
              </View>
            ) : null}

            {methodReady && !methodLoading && step === 'form' ? (
              <FormStep
                isQuestion={isQuestion}
                mode={mode}
                initialPhone={initialPhone}
                countryIso={countryIso}
                nationalDigits={nationalDigits}
                setCountryIso={setCountryIso}
                setNationalDigits={setNationalDigits}
              />
            ) : null}

            {methodReady && !methodLoading && step === 'question' ? (
              <QuestionStep phoneE164={displayNumber} />
            ) : null}

            {methodReady && !methodLoading && step === 'waiting' ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.md,
                }}
              >
                <ActivityIndicator />
                <Text variant="bodyMedium">
                  {t(
                    'mobilePaymentPhone.waiting',
                    'Waiting for you to accept the request on your phone?'
                  )}
                </Text>
              </View>
            ) : null}

            {methodReady && !methodLoading && step === 'success' ? (
              <Text variant="bodyMedium" style={{ color: colors.success.main }}>
                {isQuestion
                  ? t(
                      'mobilePaymentPhone.questionSuccess',
                      'Number confirmed. You can use it for Mobile Money payouts.'
                    )
                  : t(
                      'mobilePaymentPhone.success',
                      'Number verified. Refund of 150 XAF is on the way.'
                    )}
              </Text>
            ) : null}

            {error ? (
              <Text
                variant="bodySmall"
                style={{ color: colors.error.main, marginTop: spacing.sm }}
              >
                {error}
              </Text>
            ) : null}
          </ScrollView>

          <View style={[styles.actions, { paddingHorizontal: spacing.md, gap: spacing.sm }]}>
            {!methodReady || methodLoading ? (
              <Button mode="text" onPress={onDismiss}>
                {t('common.cancel', 'Cancel')}
              </Button>
            ) : null}

            {methodReady && !methodLoading && step === 'question' ? (
              <>
                <Button mode="text" onPress={onDismiss} disabled={busy}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                {mode !== 'verify' ? (
                  <Button mode="text" onPress={() => setStep('form')} disabled={busy}>
                    {t(
                      'mobilePaymentPhone.questionNoDifferent',
                      'No, use a different number'
                    )}
                  </Button>
                ) : null}
                <Button
                  mode="contained"
                  loading={busy}
                  disabled={busy}
                  onPress={() => void handleConfirmYes()}
                >
                  {t(
                    'mobilePaymentPhone.questionYes',
                    'Yes, it receives Mobile Money'
                  )}
                </Button>
              </>
            ) : null}

            {methodReady && !methodLoading && step !== 'question' ? (
              <Button mode="text" onPress={onDismiss} disabled={waitingLocked}>
                {step === 'success'
                  ? t('common.close', 'Close')
                  : t('common.cancel', 'Cancel')}
              </Button>
            ) : null}

            {methodReady && !methodLoading && step === 'form' ? (
              <Button
                mode="contained"
                loading={busy}
                disabled={!canSubmitForm || busy}
                onPress={() =>
                  void (mode === 'verify' && !isQuestion
                    ? handleVerifyOnlyTransaction()
                    : handleFormContinue())
                }
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
                mode="contained"
                onPress={() => setStep(isQuestion && mode === 'verify' ? 'question' : 'form')}
              >
                {t('common.retry', 'Retry')}
              </Button>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FormStep({
  isQuestion,
  mode,
  initialPhone,
  countryIso,
  nationalDigits,
  setCountryIso,
  setNationalDigits,
}: {
  isQuestion: boolean;
  mode: MobilePaymentPhoneModalMode;
  initialPhone?: MobilePaymentPhoneSummary | null;
  countryIso: CountryCode;
  nationalDigits: string;
  setCountryIso: (v: CountryCode) => void;
  setNationalDigits: (v: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
        {isQuestion
          ? t(
              'mobilePaymentPhone.questionWhy',
              'Confirm that this number is registered to receive Mobile Money so we can send your payouts there.'
            )
          : t(
              'mobilePaymentPhone.why',
              'We verify your number with a small 150 XAF mobile-money request so payouts reach the right wallet.'
            )}
      </Text>
      {!isQuestion ? (
        <Text
          variant="bodyMedium"
          style={{ color: colors.text.secondary, marginBottom: spacing.md }}
        >
          {t(
            'mobilePaymentPhone.procedure',
            'You will receive a payment request for 150 XAF. Accept it with your PIN. We refund the full amount immediately after confirmation.'
          )}
        </Text>
      ) : null}
      {mode === 'edit' ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.warning.main, marginBottom: spacing.md }}
        >
          {t(
            'mobilePaymentPhone.editWarning',
            'Changing this number will clear verification. You must verify again before payouts and product visibility resume.'
          )}
        </Text>
      ) : null}
      {mode !== 'verify' ? (
        <PhoneNumberInput
          countryIso={countryIso}
          nationalDigits={nationalDigits}
          onCountryIsoChange={setCountryIso}
          onNationalDigitsChange={setNationalDigits}
          allowedIsos={['CM', 'GA']}
        />
      ) : null}
      {mode === 'verify' && initialPhone ? (
        <Text variant="bodyLarge">{initialPhone.phone_e164}</Text>
      ) : null}
    </>
  );
}

function QuestionStep({ phoneE164 }: { phoneE164: string }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
      <MobileMoneyConfirmIllustration />
      <Text
        variant="headlineSmall"
        style={[typography.h5, { color: colors.text.primary, textAlign: 'center' }]}
      >
        {phoneE164}
      </Text>
      <Text
        variant="bodyLarge"
        style={{ color: colors.text.primary, textAlign: 'center' }}
      >
        {t(
          'mobilePaymentPhone.questionPrompt',
          'Can this number receive Mobile Money payments (MTN MoMo / Orange Money)?'
        )}
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, textAlign: 'center' }}
      >
        {t(
          'mobilePaymentPhone.questionHint',
          'Only confirm if this wallet is yours and can accept transfers.'
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  actions: {
    flexDirection: 'column',
  },
});
