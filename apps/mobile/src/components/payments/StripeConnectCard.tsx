import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Surface, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import type { StripeConnectStatusResponse } from '../../types/stripe';

type ConnectStatus = NonNullable<StripeConnectStatusResponse['data']>;

export interface StripeConnectCardProps {
  status: ConnectStatus | null;
  loading: boolean;
  /** True while a hosted onboarding / dashboard link is being opened. */
  onboarding?: boolean;
  onStartOnboarding: () => void;
  onOpenDashboard: () => void;
}

/**
 * Presentational Stripe Connect status card (mirrors the web
 * StripeConnectOnboardingCard). Shows connection/payout status pills and the
 * setup / continue / dashboard actions. All data is provided via props.
 */
export function StripeConnectCard({
  status,
  loading,
  onboarding,
  onStartOnboarding,
  onOpenDashboard,
}: StripeConnectCardProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();

  const isReady = !!status?.chargesEnabled && !!status?.payoutsEnabled;
  const isActive = status?.status === 'active' || isReady;

  return (
    <Surface
      elevation={1}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primaryTint }]}>
          <MaterialCommunityIcons name="wallet-outline" size={20} color={colors.primary.main} />
        </View>
        <Text variant="titleMedium" style={[styles.title, { color: colors.text.primary }]}>
          {t('stripe.connect.title', 'Payouts with Stripe')}
        </Text>
      </View>

      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {t(
          'stripe.connect.description',
          'Connect a Stripe account to receive payouts. A valid Stripe account also activates your account.'
        )}
      </Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary.main} />
        </View>
      ) : (
        <>
          <View style={styles.pillsRow}>
            <StatusPill
              label={
                status?.connected
                  ? t('stripe.connect.connected', 'Connected')
                  : t('stripe.connect.notConnected', 'Not connected')
              }
              backgroundColor={status?.connected ? colors.success.main + '1F' : colors.text.disabled + '1F'}
              textColor={status?.connected ? colors.success.dark : colors.text.secondary}
              icon={status?.connected ? 'check-circle-outline' : 'link-variant-off'}
            />
            <StatusPill
              label={
                status?.payoutsEnabled
                  ? t('stripe.connect.payoutsEnabled', 'Payouts enabled')
                  : t('stripe.connect.payoutsPending', 'Payouts pending')
              }
              backgroundColor={status?.payoutsEnabled ? colors.success.main + '1F' : colors.warning.main + '1F'}
              textColor={status?.payoutsEnabled ? colors.success.dark : colors.warning.dark}
              icon={status?.payoutsEnabled ? 'cash-check' : 'clock-outline'}
            />
            {status?.connected ? (
              <StatusPill
                label={
                  isActive
                    ? t('stripe.connect.active', 'Active')
                    : t('stripe.connect.underReview', 'Under review')
                }
                backgroundColor={isActive ? colors.success.main + '1F' : colors.info.main + '1F'}
                textColor={isActive ? colors.success.dark : colors.info.dark}
                icon={isActive ? 'shield-check-outline' : 'progress-clock'}
              />
            ) : null}
          </View>

          <View style={styles.actionsRow}>
            {!isReady ? (
              <Button
                mode="contained"
                onPress={onStartOnboarding}
                loading={onboarding}
                disabled={onboarding}
                style={styles.actionBtn}
              >
                {status?.connected
                  ? t('stripe.connect.continueSetup', 'Continue setup')
                  : t('stripe.connect.setup', 'Set up payouts')}
              </Button>
            ) : null}
            {status?.connected ? (
              <Button
                mode="outlined"
                onPress={onOpenDashboard}
                icon="open-in-new"
                style={styles.actionBtn}
              >
                {t('stripe.connect.dashboard', 'Open Stripe dashboard')}
              </Button>
            ) : null}
          </View>
        </>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, minWidth: 0, fontWeight: '700' },
  loadingWrap: { paddingVertical: 16, alignItems: 'center' },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionsRow: { gap: 10, marginTop: 4 },
  actionBtn: { alignSelf: 'flex-start' },
});
