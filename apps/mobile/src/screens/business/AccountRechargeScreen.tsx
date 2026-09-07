import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAccountRecharge } from '../../hooks/useAccountRecharge';
import { StatusPill } from '../../components/common/StatusPill';
import type { AccountTopUpRecord, RechargeTransaction } from '../../services/accountRechargeApi';

const SUPPORTED_COUNTRIES = [
  { code: '237', label: '🇨🇲 Cameroon (+237)' },
  { code: '241', label: '🇬🇦 Gabon (+241)' },
] as const;

function statusPillProps(
  status: RechargeTransaction['status'],
  colors: ReturnType<typeof useTheme>['colors']
): { backgroundColor: string; textColor: string } {
  switch (status) {
    case 'success':
      return { backgroundColor: colors.success.main + '22', textColor: colors.success.dark };
    case 'failed':
      return { backgroundColor: colors.error.main + '18', textColor: colors.error.dark };
    case 'cancelled':
      return { backgroundColor: colors.disabled, textColor: colors.text.secondary };
    default:
      return { backgroundColor: colors.warning.main + '22', textColor: colors.warning.dark };
  }
}

function statusLabel(
  status: RechargeTransaction['status'],
  t: ReturnType<typeof useTranslation>['t']
): string {
  const map: Record<RechargeTransaction['status'], string> = {
    pending: t('admin.accountRecharge.statusPending', 'Pending'),
    success: t('admin.accountRecharge.statusSuccess', 'Success'),
    failed: t('admin.accountRecharge.statusFailed', 'Failed'),
    cancelled: t('admin.accountRecharge.statusCancelled', 'Cancelled'),
  };
  return map[status] ?? status;
}

interface InitiatedContext {
  phone: string;
  amount: number;
  transactionId: string;
}

const AccountRechargeScreen: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();

  const {
    canAccess,
    loading,
    error,
    polling,
    polledTx,
    recentTransactions,
    transactionsLoading,
    initiateRecharge,
    loadRecent,
  } = useAccountRecharge();

  const [selectedCountryIdx, setSelectedCountryIdx] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [initiatedCtx, setInitiatedCtx] = useState<InitiatedContext | null>(null);
  const selectedCountry = SUPPORTED_COUNTRIES[selectedCountryIdx];

  const handleCountryCycle = useCallback(() => {
    setSelectedCountryIdx((i) => (i + 1) % SUPPORTED_COUNTRIES.length);
  }, []);

  const handleSubmit = useCallback(async () => {
    setFormError(null);
    if (!phoneNumber.trim()) {
      setFormError(t('admin.accountRecharge.errorPhoneRequired', 'Phone number is required'));
      return;
    }
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum < 150) {
      setFormError(t('admin.accountRecharge.errorAmountMin', 'Amount must be at least 150 XAF'));
      return;
    }
    // Clear stale context immediately so the status card doesn't show
    // a previous transaction's details while the new request is in-flight.
    setInitiatedCtx(null);
    try {
      const fullPhone = `+${selectedCountry.code}${phoneNumber.trim()}`;
      const result = await initiateRecharge({
        countryCode: selectedCountry.code,
        phoneNumber: phoneNumber.trim(),
        amount: amountNum,
      });
      setInitiatedCtx({ phone: fullPhone, amount: amountNum, transactionId: result.transactionId });
      setPhoneNumber('');
      setAmount('');
    } catch {
      // error shown via hook
    }
  }, [amount, initiateRecharge, phoneNumber, selectedCountry.code, t]);

  if (!canAccess) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <Text style={[typography.body1, { color: colors.error.main }]}>
          {t('admin.accountRecharge.unauthorized', 'You are not authorized to perform this action')}
        </Text>
      </View>
    );
  }

  const txStatus = polledTx?.status ?? (initiatedCtx ? 'pending' : null);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.pageBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.xl, paddingTop: spacing.md },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <ActivityIndicator animating={transactionsLoading} color={colors.primary.main} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={[typography.subtitle1, { color: colors.text.secondary, marginBottom: spacing.md }]}>
          {t('admin.accountRecharge.subtitle', 'Collect from a mobile number to top up the Rendasua HQ account')}
        </Text>

        {/* Form card */}
        <View
          style={[
            styles.card,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.card,
              borderColor: colors.divider,
              padding: spacing.md,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <Text style={[typography.h6, { color: colors.text.primary, marginBottom: spacing.md }]}>
            {t('admin.accountRecharge.formCard', 'Initiate payment')}
          </Text>

          {/* Country selector */}
          <Button
            mode="outlined"
            onPress={handleCountryCycle}
            style={{ marginBottom: spacing.md }}
            contentStyle={{ justifyContent: 'flex-start' }}
          >
            {selectedCountry.label}
          </Button>

          <TextInput
            label={t('admin.accountRecharge.phoneLabel', 'Phone number (local)')}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder={t('admin.accountRecharge.phonePlaceholder', 'e.g. 670000000')}
            keyboardType="phone-pad"
            mode="outlined"
            style={{ marginBottom: spacing.sm }}
          />
          <Text style={[typography.caption, { color: colors.text.secondary, marginBottom: spacing.md }]}>
            {t('admin.accountRecharge.phoneHelp', 'Without country code')}
          </Text>

          <TextInput
            label={t('admin.accountRecharge.amountLabel', 'Amount (XAF)')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            mode="outlined"
            style={{ marginBottom: spacing.sm }}
          />
          <Text style={[typography.caption, { color: colors.text.secondary, marginBottom: spacing.md }]}>
            {t('admin.accountRecharge.amountHelp', 'Minimum 150 XAF')}
          </Text>

          {(formError || error) ? (
            <View
              style={[
                { backgroundColor: colors.error.main + '18', borderRadius: borderRadius.sm, padding: spacing.sm, marginBottom: spacing.md },
              ]}
            >
              <Text style={[typography.caption, { color: colors.error.dark }]}>
                {formError ?? error}
              </Text>
            </View>
          ) : null}

          <Button
            mode="contained"
            onPress={() => void handleSubmit()}
            loading={loading}
            disabled={loading || polling}
            style={{ width: '100%' }}
          >
            {t('admin.accountRecharge.initiateButton', 'Initiate payment')}
          </Button>
        </View>

        {/* Post-initiation status + instruction card */}
        {initiatedCtx ? (
          <View
            style={[
              styles.card,
              shadows.sm,
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadius.card,
                borderColor: colors.divider,
                padding: spacing.md,
                marginBottom: spacing.lg,
              },
            ]}
          >
            <Text style={[typography.h6, { color: colors.text.primary, marginBottom: spacing.sm }]}>
              {t('admin.accountRecharge.statusCard', 'Payment status')}
            </Text>

            {/* Instructions while pending */}
            {txStatus === 'pending' && (
              <View style={{ marginBottom: spacing.md }}>
                <View
                  style={[
                    styles.infoBox,
                    { backgroundColor: colors.primaryTint, borderRadius: borderRadius.sm, padding: spacing.sm, marginBottom: spacing.md },
                  ]}
                >
                  <Text style={[typography.body2, { color: colors.primary.main }]}>
                    {t(
                      'admin.accountRecharge.sentToPhone',
                      'A payment request of {{amount}} XAF has been sent to {{phone}}.',
                      { amount: initiatedCtx.amount.toLocaleString(), phone: initiatedCtx.phone }
                    )}
                  </Text>
                </View>

                {[
                  {
                    emoji: '📱',
                    text: t(
                      'admin.accountRecharge.step1',
                      'The owner of {{phone}} will receive a prompt on their phone to approve the payment.',
                      { phone: initiatedCtx.phone }
                    ),
                  },
                  {
                    emoji: '⏳',
                    text: t(
                      'admin.accountRecharge.step2',
                      'Ask them to accept the request and enter their mobile money PIN.'
                    ),
                  },
                  {
                    emoji: '🏦',
                    text: t(
                      'admin.accountRecharge.step3',
                      'Once approved, the HQ account will be credited automatically and this status will update.'
                    ),
                  },
                ].map((step, i) => (
                  <View key={i} style={[styles.stepRow, { marginBottom: spacing.xs }]}>
                    <Text style={[typography.body2, { minWidth: 24 }]}>{step.emoji}</Text>
                    <Text style={[typography.body2, { color: colors.text.secondary, flex: 1 }]} numberOfLines={3}>
                      {step.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Live status */}
            <View style={[styles.row, { marginBottom: spacing.xs }]}>
              {polling ? <ActivityIndicator size="small" color={colors.primary.main} style={{ marginRight: spacing.sm }} /> : null}
              <StatusPill
                label={statusLabel(txStatus ?? 'pending', t)}
                {...statusPillProps(txStatus ?? 'pending', colors)}
              />
            </View>
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {t('admin.accountRecharge.txId', 'TX ID')}: {initiatedCtx.transactionId}
            </Text>

            {/* Success message */}
            {polledTx?.status === 'success' ? (
              <View
                style={[
                  { backgroundColor: colors.success.main + '18', borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.sm },
                ]}
              >
                <Text style={[typography.body2, { color: colors.success.dark, fontWeight: '600', marginBottom: 2 }]}>
                  {t('admin.accountRecharge.successTitle', 'Payment confirmed!')}
                </Text>
                <Text style={[typography.body2, { color: colors.success.dark }]}>
                  {t(
                    'admin.accountRecharge.successMessage',
                    'The HQ account has been credited with {{amount}} XAF from {{phone}}. The deposit appears in the "Recent recharges" list below.',
                    { amount: initiatedCtx.amount.toLocaleString(), phone: initiatedCtx.phone }
                  )}
                </Text>
              </View>
            ) : null}

            {/* Failed message */}
            {polledTx?.status === 'failed' ? (
              <View
                style={[
                  { backgroundColor: colors.error.main + '18', borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.sm },
                ]}
              >
                <Text style={[typography.body2, { color: colors.error.dark }]}>
                  {polledTx.error_message ?? t('admin.accountRecharge.failedMessage', 'Payment failed.')}
                </Text>
              </View>
            ) : null}

            {/* Cancelled message */}
            {polledTx?.status === 'cancelled' ? (
              <View
                style={[
                  { backgroundColor: colors.warning.main + '18', borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.sm },
                ]}
              >
                <Text style={[typography.body2, { color: colors.warning.dark }]}>
                  {t('admin.accountRecharge.cancelledMessage', 'Payment was cancelled.')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Recent confirmed deposits */}
        <Text style={[typography.h6, { color: colors.text.primary, marginBottom: spacing.sm }]}>
          {t('admin.accountRecharge.recentTitle', 'Recent recharges')}
        </Text>

        {transactionsLoading && recentTransactions.length === 0 ? (
          <ActivityIndicator color={colors.primary.main} style={{ marginVertical: spacing.md }} />
        ) : recentTransactions.length === 0 ? (
          <Text style={[typography.body2, { color: colors.text.secondary }]}>
            {t('admin.accountRecharge.noRecentRecharges', 'No recent recharges.')}
          </Text>
        ) : (
          recentTransactions.map((tx: AccountTopUpRecord) => (
            <View
              key={tx.id}
              style={[
                styles.txRow,
                shadows.sm,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.divider,
                  borderRadius: borderRadius.sm,
                  padding: spacing.sm,
                  marginBottom: spacing.sm,
                  maxWidth: width - spacing.md * 2,
                },
              ]}
            >
              <Text style={[typography.body2, { color: colors.text.primary, flex: 1 }]} numberOfLines={2}>
                {tx.memo}
              </Text>
              <View style={[styles.txFooter, { marginTop: spacing.xs }]}>
                <Text style={[typography.caption, { color: colors.text.secondary, flex: 1, minWidth: 0 }]} numberOfLines={1}>
                  {new Date(tx.created_at).toLocaleString()}
                </Text>
                <Text style={[typography.caption, { color: colors.success.dark, fontWeight: '600' }]}>
                  +{Number(tx.amount).toLocaleString()} XAF
                </Text>
              </View>
            </View>
          ))
        )}

        {recentTransactions.length > 0 && (
          <Button
            mode="text"
            onPress={() => void loadRecent()}
            disabled={transactionsLoading}
            style={{ alignSelf: 'center', marginTop: spacing.sm }}
          >
            {t('admin.accountRecharge.refresh', 'Refresh')}
          </Button>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { flexGrow: 1 },
  card: { borderWidth: 1 },
  infoBox: {},
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  txRow: { borderWidth: 1 },
  txFooter: { flexDirection: 'row', alignItems: 'center' },
});

export default AccountRechargeScreen;
