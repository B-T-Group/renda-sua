import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAgentEarningsSummary } from '../../hooks/useAgentEarningsSummary';
import { useAgentXafWallet } from '../../hooks/useAgentXafWallet';
import { resolveDisplayCurrency, useUserCurrency } from '../../hooks/useUserCurrency';
import { shadows } from '../../theme/shadows';
import type { RecentCommission } from '../../types/agent';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function EarningsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation<{ navigate: (name: string) => void }>();

  const { summary, loading: earningsLoading, error: earningsError, refetch: refetchEarnings } =
    useAgentEarningsSummary(true);
  const { currency: meCurrency } = useUserCurrency(true);
  const { availableBalance, currency: walletCurrency, loading: walletLoading } = useAgentXafWallet(
    true,
    meCurrency
  );

  const currency = resolveDisplayCurrency(
    walletCurrency,
    meCurrency,
    summary?.currency
  );

  const loading = earningsLoading || walletLoading;

  const handleRefresh = useCallback(async () => {
    await refetchEarnings();
  }, [refetchEarnings]);

  const handleWithdraw = useCallback(() => {
    navigation.navigate('AgentAccounts');
  }, [navigation]);

  if (earningsLoading && !summary) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (earningsError && !summary) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={40} color={colors.error.main} />
        <Text variant="bodyMedium" style={[styles.errorText, { color: colors.error.main }]}>
          {earningsError}
        </Text>
        <Pressable
          onPress={handleRefresh}
          style={[styles.retryBtn, { backgroundColor: colors.primary.main, borderRadius: borderRadius.sm }]}
        >
          <Text variant="labelMedium" style={{ color: colors.primary.contrast }}>
            {t('common.retry', 'Retry')}
          </Text>
        </Pressable>
      </View>
    );
  }


  const commissions: RecentCommission[] = summary?.recentCommissions ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.pageBackground }]} edges={['bottom']}>
      <FlatList
        data={commissions}
        keyExtractor={(item) => item.orderId}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} colors={[colors.primary.main]} />
        }
        ListHeaderComponent={
          <>
            {/* Today's earnings hero */}
            <View
              style={[
                styles.heroCard,
                shadows.md,
                {
                  backgroundColor: colors.primary.main,
                  borderRadius: borderRadius.lg,
                  margin: spacing.md,
                },
              ]}
            >
              <Text
                variant="labelSmall"
                style={[styles.heroLabel, { color: colors.primary.contrast + 'cc' }]}
              >
                {t('agent.earnings.todaysEarnings', "Today's earnings").toUpperCase()}
              </Text>
              <Text
                variant="displaySmall"
                style={[styles.heroAmount, { color: colors.primary.contrast }]}
              >
                {summary ? formatCurrency(summary.todayEarnings, currency) : '—'}
              </Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <MaterialCommunityIcons name="truck-check-outline" size={16} color={colors.primary.contrast + 'cc'} />
                  <Text variant="bodySmall" style={[styles.heroStatLabel, { color: colors.primary.contrast + 'cc' }]}>
                    {summary?.todayDeliveryCount ?? 0} {t('agent.earnings.deliveries', 'deliveries')}
                  </Text>
                </View>
                <View style={styles.heroStat}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary.contrast + 'cc'} />
                  <Text variant="bodySmall" style={[styles.heroStatLabel, { color: colors.primary.contrast + 'cc' }]}>
                    {summary?.activeOrderCount ?? 0} {t('agent.earnings.active', 'active')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Wallet balance + primary Withdraw CTA */}
            <View
              style={[
                styles.walletRow,
                shadows.sm,
                {
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.md,
                  marginHorizontal: spacing.md,
                  marginBottom: spacing.md,
                  borderColor: colors.divider,
                },
              ]}
            >
              <View style={styles.walletInfo}>
                <Text variant="labelSmall" style={{ color: colors.text.disabled, letterSpacing: 0.8 }}>
                  {t('agent.accounts.balance', 'WALLET BALANCE').toUpperCase()}
                </Text>
                <Text variant="titleLarge" style={[styles.walletBalance, { color: colors.text.primary }]}>
                  {walletLoading ? (
                    <ActivityIndicator size="small" color={colors.primary.main} />
                  ) : (
                    formatCurrency(availableBalance, resolveDisplayCurrency(walletCurrency, meCurrency))
                  )}
                </Text>
              </View>
              <Pressable
                onPress={handleWithdraw}
                style={({ pressed }) => [
                  styles.withdrawBtn,
                  {
                    backgroundColor: colors.success.main,
                    borderRadius: borderRadius.sm,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('agent.accounts.withdraw', 'Withdraw')}
              >
                <MaterialCommunityIcons name="bank-transfer-out" size={18} color="#fff" />
                <Text variant="labelMedium" style={[styles.withdrawLabel, { color: '#fff' }]}>
                  {t('agent.accounts.withdraw', 'Withdraw')}
                </Text>
              </Pressable>
            </View>

            {/* Section title */}
            <Text
              variant="titleSmall"
              style={[styles.sectionTitle, { color: colors.text.primary, paddingHorizontal: spacing.md }]}
            >
              {t('agent.earnings.recentCommissions', 'Recent commissions')}
            </Text>
          </>
        }
        ListEmptyComponent={
          <View style={[styles.emptyWrap, { marginHorizontal: spacing.md }]}>
            <MaterialCommunityIcons name="cash-clock" size={36} color={colors.text.disabled} />
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: 8 }}>
              {t('agent.earnings.noCommissions', 'No recent commissions yet')}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            style={[
              styles.commissionRow,
              {
                backgroundColor: colors.surface,
                borderTopWidth: index === 0 ? StyleSheet.hairlineWidth : 0,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderColor: colors.divider,
              },
            ]}
          >
            <View style={styles.commissionLeft}>
              <View style={[styles.commissionIcon, { backgroundColor: colors.success.main + '14', borderRadius: borderRadius.sm }]}>
                <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.success.main} />
              </View>
              <View style={styles.commissionText}>
                <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
                  {t('agent.earnings.orderLabel', 'Order')} #{item.orderNumber}
                </Text>
                {item.deliveredAt ? (
                  <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                    {formatDate(item.deliveredAt)}
                  </Text>
                ) : null}
              </View>
            </View>
            <Text variant="titleSmall" style={[styles.commissionAmount, { color: colors.success.dark }]}>
              +{formatCurrency(item.amount, currency)}
            </Text>
          </Pressable>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  errorText: { textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  heroCard: { padding: 20, gap: 8 },
  heroLabel: { fontWeight: '700', letterSpacing: 1 },
  heroAmount: { fontWeight: '800', lineHeight: 40 },
  heroStats: { flexDirection: 'row', gap: 20, marginTop: 4 },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroStatLabel: {},
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  walletInfo: { flex: 1, gap: 2 },
  walletBalance: { fontWeight: '700' },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  withdrawLabel: { fontWeight: '700' },
  sectionTitle: { marginBottom: 8, fontWeight: '700', marginTop: 4 },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 4,
  },
  commissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 64,
  },
  commissionLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  commissionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  commissionText: { flex: 1, minWidth: 0, gap: 2 },
  commissionAmount: { fontWeight: '700', flexShrink: 0 },
});
