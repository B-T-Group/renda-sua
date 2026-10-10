import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useMainTabContentBottomPadding } from '../../hooks/useMainTabContentBottomPadding';
import { useAgentPayBoard } from '../../hooks/useAgentPayBoard';
import { PayEarningsHero } from '../../components/agent/pay/PayEarningsHero';
import { PaySegmentBar } from '../../components/agent/pay/PaySegmentBar';
import { PayStatusFilter } from '../../components/agent/pay/PayStatusFilter';
import { MerchantCommissionCard } from '../../components/agent/pay/MerchantCommissionCard';
import { ScheduleObjectiveCard } from '../../components/agent/pay/ScheduleObjectiveCard';
import { PayGenericCard } from '../../components/agent/pay/PayGenericCard';
import { PayEmptyIllustration } from '../../components/illustrations/PayEmptyIllustration';
import UserAccountsScreen from '../shared/UserAccountsScreen';
import { isMerchantItem, isScheduleItem, itemsForSegment } from '../../utils/agentPayBoard';
import type { MainTabParamList } from '../../navigation/AgentRootNavigator';
import type { EarningItem, PayBoardStatus, PaySegment } from '../../types/agentPayBoard';

export default function AgentPayScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const bottomPad = useMainTabContentBottomPadding(24);
  const route = useRoute<RouteProp<MainTabParamList, 'Pay'>>();
  const navigation = useNavigation<{ getParent: () => { navigate: (name: string) => void } | undefined }>();
  const [segment, setSegment] = useState<PaySegment>(route.params?.segment ?? 'commissions');
  const [status, setStatus] = useState<PayBoardStatus>('unpaid');
  const { board, loading, error, refetch } = useAgentPayBoard(status);

  useEffect(() => {
    if (route.params?.segment) setSegment(route.params.segment);
  }, [route.params?.segment]);

  useEffect(() => {
    if (segment !== 'commissions' && status === 'expired') setStatus('unpaid');
  }, [segment, status]);

  const items =
    segment === 'wallet' ? [] : itemsForSegment(board?.items ?? [], segment);

  const openReferrals = useCallback(() => {
    navigation.getParent()?.navigate('AgentBusinessReferral');
  }, [navigation]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <PayEarningsHero summary={board?.summary ?? null} />
      <PaySegmentBar value={segment} onChange={setSegment} />
      {segment === 'wallet' ? (
        <UserAccountsScreen embedded contentBottomPadding={bottomPad} />
      ) : (
        <PayList
          items={items}
          status={status}
          onStatus={setStatus}
          showExpired={segment === 'commissions'}
          loading={loading}
          error={error}
          bottomPad={bottomPad}
          emptyTitle={emptyTitle(segment, status, t)}
          showRefer={segment === 'commissions' && status !== 'paid'}
          onRefer={openReferrals}
          onRefresh={() => void refetch()}
          refreshing={loading && !!board}
        />
      )}
    </View>
  );
}

function PayList({
  items,
  status,
  onStatus,
  showExpired,
  loading,
  error,
  bottomPad,
  emptyTitle,
  showRefer,
  onRefer,
  onRefresh,
  refreshing,
}: {
  items: EarningItem[];
  status: PayBoardStatus;
  onStatus: (status: PayBoardStatus) => void;
  showExpired: boolean;
  loading: boolean;
  error: string | null;
  bottomPad: number;
  emptyTitle: string;
  showRefer: boolean;
  onRefer: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={[styles.centered, { padding: spacing.lg, gap: spacing.sm }]}>
        <Text variant="bodyMedium" style={{ color: colors.error.main, textAlign: 'center' }}>
          {error}
        </Text>
        <Pressable onPress={onRefresh}>
          <Text variant="labelLarge" style={{ color: colors.primary.main }}>
            {t('common.retry', 'Retry')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={<PayStatusFilter value={status} onChange={onStatus} showExpired={showExpired} />}
      contentContainerStyle={{ paddingBottom: bottomPad, flexGrow: 1 }}
      ListEmptyComponent={
        <View style={[styles.centered, { padding: spacing.lg, gap: spacing.sm }]}>
          <PayEmptyIllustration label={emptyTitle} />
          <Text variant="titleMedium" style={{ color: colors.text.primary, textAlign: 'center' }}>
            {emptyTitle}
          </Text>
          {showRefer ? (
            <Pressable onPress={onRefer}>
              <Text variant="labelLarge" style={{ color: colors.primary.main }}>
                {t('agent.pay.referBusiness', 'Refer a business')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      }
      renderItem={({ item }) => <PayRow item={item} />}
    />
  );
}

function PayRow({ item }: { item: EarningItem }) {
  if (isMerchantItem(item)) return <MerchantCommissionCard item={item} structure={item.structure} />;
  if (isScheduleItem(item)) return <ScheduleObjectiveCard item={item} structure={item.structure} />;
  return <PayGenericCard item={item} />;
}

function emptyTitle(
  segment: PaySegment,
  status: PayBoardStatus,
  t: (key: string, fallback: string) => string
): string {
  if (status === 'paid') return t('agent.pay.emptyPaid', 'Nothing paid yet');
  if (status === 'expired') return t('agent.pay.emptyExpired', 'No expired commissions');
  if (segment === 'objectives') return t('agent.pay.emptyObjectives', 'No open objectives');
  return t('agent.pay.emptyCommissions', 'No unpaid commissions');
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
