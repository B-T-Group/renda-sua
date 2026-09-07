import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from 'libphonenumber-js';
import { Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { AppModal } from '../common/AppModal';
import { getDeviceDefaultCountryCode } from '../../utils/deviceDefaultCountry';
import { e164ToCountryAndNational } from '../../utils/phoneLoginUsername';
import {
  MIN_WITHDRAW_AMOUNT_XAF,
  MIN_WITHDRAW_AMOUNT_STRIPE,
  isWithdrawPhoneFormValid,
  withdrawPhoneFormToE164,
} from '../../utils/withdrawValidation';
import { formatCurrency } from '../../utils/formatters';
import { agentApi } from '../../services/agentApi';
import PhoneNumberInput from '../PhoneNumberInput';

export interface AgentWithdrawDialogProps {
  visible: boolean;
  onDismiss: () => void;
  defaultPhone: string;
  currency: string;
  availableBalance: number;
  submitting: boolean;
  /**
   * Withdrawal rail.
   * - `stripe`       – no phone field, minimum 1.00 in account currency;
   *                    funds are paid out to the user's Stripe Connect account.
   * - `mobile_money` – phone number required, XAF minimum applies.
   */
  mode?: 'mobile_money' | 'stripe';
  /** When set, loads withdrawal-config (PIN requirement) for this account. */
  accountId?: string;
  /** Shows a note that the phone is the location withdrawal number. */
  isLocationAccount?: boolean;
  onConfirm: (
    amount: number,
    phoneE164?: string,
    pin?: string
  ) => Promise<{ success: boolean; message?: string }>;
}

function pickDefaultMobileMoneyCountry(preferred?: CountryCode): CountryCode {
  if (preferred === 'CM' || preferred === 'GA') return preferred;
  const d = getDeviceDefaultCountryCode();
  return d === 'CM' || d === 'GA' ? d : 'CM';
}

function initialWithdrawPhone(
  defaultPhone: string
): { countryIso: CountryCode; nationalDigits: string } {
  const raw = defaultPhone.trim();
  if (!raw) {
    return { countryIso: pickDefaultMobileMoneyCountry(), nationalDigits: '' };
  }
  const parsed = e164ToCountryAndNational(raw);
  if (parsed && (parsed.countryIso === 'CM' || parsed.countryIso === 'GA')) {
    return parsed;
  }
  return { countryIso: pickDefaultMobileMoneyCountry(), nationalDigits: '' };
}

export function AgentWithdrawDialog({
  visible,
  onDismiss,
  defaultPhone,
  currency,
  availableBalance,
  submitting,
  mode = 'mobile_money',
  accountId,
  isLocationAccount = false,
  onConfirm,
}: AgentWithdrawDialogProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const isStripe = mode === 'stripe';
  const safeCurrency = (currency?.trim().toUpperCase() || 'XAF').slice(0, 3);

  const [countryIso, setCountryIso] = useState<CountryCode>('CM');
  const [nationalDigits, setNationalDigits] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [requirePin, setRequirePin] = useState(false);
  const [pinConfigLoading, setPinConfigLoading] = useState(false);
  const [pinConfigError, setPinConfigError] = useState(false);
  const [pinConfigRetry, setPinConfigRetry] = useState(0);
  const [phoneLocked, setPhoneLocked] = useState(false);
  const phoneTouchedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      phoneTouchedRef.current = false;
      return;
    }
    setAmount('');
    setPin('');
    setError('');
    setRequirePin(false);
    setPinConfigError(false);
    setPinConfigRetry(0);
  }, [visible]);

  useEffect(() => {
    if (!visible || phoneTouchedRef.current) return;
    const init = initialWithdrawPhone(defaultPhone);
    setCountryIso(init.countryIso);
    setNationalDigits(init.nationalDigits);
    setPhoneLocked(init.nationalDigits.length > 0);
  }, [visible, defaultPhone]);

  useEffect(() => {
    if (!visible || !accountId || isStripe) {
      setRequirePin(false);
      setPinConfigLoading(false);
      setPinConfigError(false);
      return;
    }
    let cancelled = false;
    setPinConfigLoading(true);
    setPinConfigError(false);
    void (async () => {
      try {
        const res = await agentApi.accounts.withdrawalConfig(accountId);
        if (cancelled) return;
        setRequirePin(!!res.data?.requirePin);
        setPinConfigError(false);
      } catch {
        if (cancelled) return;
        setRequirePin(false);
        setPinConfigError(true);
      } finally {
        if (!cancelled) setPinConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, accountId, isStripe, pinConfigRetry]);

  const retryPinConfig = useCallback(() => {
    setPinConfigRetry((n) => n + 1);
  }, []);

  const minAmount = isStripe ? MIN_WITHDRAW_AMOUNT_STRIPE : MIN_WITHDRAW_AMOUNT_XAF;
  const parsedAmount = parseFloat(amount);
  const amountOk =
    amount.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount >= minAmount &&
    parsedAmount <= availableBalance;

  const balanceOk = availableBalance >= minAmount;
  const phoneOk = isStripe || isWithdrawPhoneFormValid(countryIso, nationalDigits);
  const hasDigits = nationalDigits.replace(/\D/g, '').length > 0;
  const pinOk = !requirePin || /^\d{4}$/.test(pin.trim());
  const canSubmit =
    balanceOk &&
    phoneOk &&
    amountOk &&
    pinOk &&
    !submitting &&
    !pinConfigLoading &&
    !pinConfigError;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    if (isStripe) {
      setError('');
      const res = await onConfirm(parsedAmount);
      if (res.success) onDismiss();
      else setError(res.message ?? t('accounts.withdrawFailed', 'Withdrawal could not be started.'));
      return;
    }
    const e164 = withdrawPhoneFormToE164(countryIso, nationalDigits);
    if (!e164) {
      setError(
        t(
          'accounts.withdrawPhoneCmGaOnly',
          'Only Cameroon (+237) or Gabon (+241) phone numbers are supported.'
        )
      );
      return;
    }
    if (requirePin && !/^\d{4}$/.test(pin.trim())) {
      setError(t('accounts.withdrawalPinHint', 'Enter your 4-digit withdrawal PIN.'));
      return;
    }
    setError('');
    const res = await onConfirm(
      parsedAmount,
      e164,
      requirePin ? pin.trim() : undefined
    );
    if (res.success) onDismiss();
    else setError(res.message ?? t('accounts.withdrawFailed', 'Withdrawal could not be started.'));
  }, [
    canSubmit,
    submitting,
    isStripe,
    countryIso,
    nationalDigits,
    parsedAmount,
    requirePin,
    pin,
    onConfirm,
    onDismiss,
    t,
  ]);

  const mmHint = useMemo(
    () => t('accounts.withdrawPhoneCmGaHint', 'Use a Cameroon (+237) or Gabon (+241) mobile number.'),
    [t]
  );

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={submitting ? undefined : onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={submitting ? undefined : onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel', 'Cancel')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            variant="titleLarge"
            style={[styles.title, { color: colors.text.primary, paddingHorizontal: spacing.lg }]}
          >
            {isStripe
              ? t('accounts.stripeWithdrawTitle', 'Withdraw to Stripe')
              : t('accounts.withdrawRequest', 'Withdraw')}
          </Text>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
              paddingTop: spacing.sm,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 8 }}>
              {t('accounts.availableBalance', 'Available balance')}:{' '}
              <Text style={{ color: colors.success.main, fontWeight: '600' }}>
                {formatCurrency(availableBalance, safeCurrency)}
              </Text>
            </Text>

            {!balanceOk && (
              <Text variant="bodySmall" style={{ color: colors.warning.main, marginBottom: 8 }}>
                {t('accounts.minWithdrawBalance', 'Minimum withdrawal is {{min}} {{currency}}.', {
                  min: minAmount,
                  currency: safeCurrency,
                })}
              </Text>
            )}

            {isStripe ? (
              <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 12 }}>
                {t(
                  'accounts.stripeWithdrawHelper',
                  'Funds will be paid out to your connected Stripe bank account.'
                )}
              </Text>
            ) : (
              <>
                <View style={styles.phoneLabelRow}>
                  <Text variant="labelLarge" style={{ color: colors.text.primary, flex: 1 }}>
                    {t('accounts.mobileMoneyPhone', 'Mobile Money phone')}
                  </Text>
                  {phoneLocked ? (
                    <Button
                      mode="text"
                      compact
                      onPress={() => {
                        phoneTouchedRef.current = true;
                        setPhoneLocked(false);
                      }}
                      disabled={submitting}
                    >
                      {t('accounts.updatePhone', 'Update')}
                    </Button>
                  ) : null}
                </View>
                <PhoneNumberInput
                  countryIso={countryIso}
                  nationalDigits={nationalDigits}
                  onCountryIsoChange={(iso) => {
                    phoneTouchedRef.current = true;
                    setCountryIso(iso);
                  }}
                  onNationalDigitsChange={(digits) => {
                    phoneTouchedRef.current = true;
                    setNationalDigits(digits);
                  }}
                  hasError={hasDigits && !phoneOk}
                  disabled={submitting || phoneLocked}
                />
                <Text
                  variant="bodySmall"
                  style={{ color: colors.text.secondary, marginTop: 8, marginBottom: 12 }}
                >
                  {isLocationAccount
                    ? t(
                        'accounts.withdrawalPhoneNoteLocation',
                        "This is the phone number used for withdrawals from this location's account."
                      )
                    : mmHint}
                </Text>
              </>
            )}

            <Text variant="labelLarge" style={{ color: colors.text.primary, marginBottom: 4 }}>
              {t('accounts.amount', 'Amount')}
            </Text>
            <TextInput
              mode="outlined"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!submitting && balanceOk}
              placeholder={String(minAmount)}
              right={<TextInput.Affix text={safeCurrency} />}
              style={[typography.body2 as object]}
            />
            {!isStripe && (
              <Text variant="bodySmall" style={{ color: colors.text.disabled, marginTop: 4 }}>
                {t('accounts.minAmountHint', 'Min. {{min}} {{currency}}', {
                  min: minAmount,
                  currency: safeCurrency,
                })}
              </Text>
            )}

            {pinConfigLoading ? (
              <View style={styles.pinLoading}>
                <ActivityIndicator color={colors.primary.main} size="small" />
              </View>
            ) : null}

            {!isStripe && pinConfigError ? (
              <View style={{ marginTop: 8, gap: 4 }}>
                <Text variant="bodySmall" style={{ color: colors.error.main }}>
                  {t(
                    'accounts.withdrawalConfigFailed',
                    'Could not load withdrawal settings. Try again.'
                  )}
                </Text>
                <Button mode="text" compact onPress={retryPinConfig} disabled={pinConfigLoading}>
                  {t('common.retry', 'Retry')}
                </Button>
              </View>
            ) : null}

            {!isStripe && requirePin ? (
              <View style={{ marginTop: spacing.md }}>
                <Text variant="labelLarge" style={{ color: colors.text.primary, marginBottom: 4 }}>
                  {t('accounts.withdrawalPin', 'Withdrawal PIN')}
                </Text>
                <TextInput
                  mode="outlined"
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  editable={!submitting}
                  placeholder="••••"
                  style={[typography.body2 as object]}
                />
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
                  {t('accounts.withdrawalPinHint', 'Enter your 4-digit withdrawal PIN.')}
                </Text>
              </View>
            ) : null}

            {error ? (
              <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: 8 }}>
                {error}
              </Text>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.actions,
              {
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
                gap: spacing.xs,
              },
            ]}
          >
            <Button mode="text" onPress={onDismiss} disabled={submitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={() => void handleSubmit()}
              loading={submitting}
              disabled={!canSubmit}
            >
              {isStripe
                ? t('accounts.withdrawToStripe', 'Withdraw to Stripe')
                : t('accounts.withdraw', 'Withdraw')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    overflow: 'hidden',
    paddingTop: 20,
  },
  title: { fontWeight: '700' },
  phoneLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  pinLoading: { alignItems: 'flex-start', marginTop: 12 },
});
