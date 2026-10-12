import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAgentDeliveryEarnings } from '../../../hooks/useAgentDeliveryEarnings';
import { PayEmptyIllustration } from '../../illustrations/PayEmptyIllustration';
import { formatCurrency } from '../../../utils/formatters';
import { DeliveryPeriodFilter } from './DeliveryPeriodFilter';
import { DeliveryRateCard } from './DeliveryRateCard';
import { DeliveryTripCard } from './DeliveryTripCard';
import type { DeliveryEarningsPeriod, DeliveryPayRates } from '../../../types/agentDeliveryEarnings';

export function DeliveryEarningsPanel({ bottomPad }: { bottomPad: number }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [period, setPeriod] = useState<DeliveryEarningsPeriod>('month');
  const { earnings, loading, error, refetch } = useAgentDeliveryEarnings(period);
  const emptyTitle = t('agent.pay.deliveries.empty', 'No deliveries in this period');

  if (loading && !earnings) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (error && !earnings) {
    return (
      <View style={[styles.centered, { padding: spacing.lg, gap: spacing.sm }]}>
        <Text variant="bodyMedium" style={{ color: colors.error.main, textAlign: 'center' }}>
          {error}
        </Text>
        <Pressable onPress={() => void refetch()}>
          <Text variant="labelLarge" style={{ color: colors.primary.main }}>
            {t('common.retry', 'Retry')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={earnings?.trips ?? []}
      keyExtractor={(trip) => trip.orderId}
      refreshControl={
        <RefreshControl refreshing={loading && !!earnings} onRefresh={() => void refetch()} />
      }
      ListHeaderComponent={
        <DeliveryListHeader
          period={period}
          onPeriod={setPeriod}
          currency={earnings?.currency ?? ''}
          earnedAmount={earnings?.earnedAmount ?? 0}
          tripCount={earnings?.tripCount ?? 0}
          pay={earnings?.pay ?? null}
        />
      }
      contentContainerStyle={{ paddingBottom: bottomPad, flexGrow: 1 }}
      ListEmptyComponent={
        <View style={[styles.centered, { padding: spacing.lg, gap: spacing.sm }]}>
          <PayEmptyIllustration label={emptyTitle} />
          <Text variant="titleMedium" style={{ color: colors.text.primary, textAlign: 'center' }}>
            {emptyTitle}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <DeliveryTripCard trip={item} currency={earnings?.currency ?? ''} />
      )}
    />
  );
}

function DeliveryListHeader({
  period,
  onPeriod,
  currency,
  earnedAmount,
  tripCount,
  pay,
}: {
  period: DeliveryEarningsPeriod;
  onPeriod: (period: DeliveryEarningsPeriod) => void;
  currency: string;
  earnedAmount: number;
  tripCount: number;
  pay: DeliveryPayRates | null;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {pay ? <DeliveryRateCard pay={pay} currency={currency} /> : null}
      <DeliveryPeriodFilter value={period} onChange={onPeriod} />
      <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
        <Text variant="headlineSmall" style={{ color: colors.text.primary }}>
          {currency ? formatCurrency(earnedAmount, currency) : ''}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t('agent.pay.deliveries.tripCount', '{{count}} trips', { count: tripCount })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
