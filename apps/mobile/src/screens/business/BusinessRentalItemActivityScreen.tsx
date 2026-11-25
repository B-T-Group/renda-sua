import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Button, SegmentedButtons, Text } from 'react-native-paper';
import { RentalItemActivityStatsStrip } from '../../components/business/rentals/RentalItemActivityStatsStrip';
import { RentalPhaseStatusPill } from '../../components/common/RentalPhaseStatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { rentalsApi } from '../../services/rentalsApi';
import type {
  BusinessRentalItemActivity,
  BusinessRentalItemActivityBooking,
  BusinessRentalItemActivityScope,
} from '../../types/rentals';
import {
  formatRentalMoney,
  formatRentalRequestLocalDateTime,
} from '../../utils/rentals';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessRentalItemActivity'>;
type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export default function BusinessRentalItemActivityScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const itemId = route.params.itemId;
  const [scope, setScope] = useState<BusinessRentalItemActivityScope>('all');
  const [data, setData] = useState<BusinessRentalItemActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const suggestedApplied = useRef(false);

  const fetchActivity = useCallback(
    async (nextScope: BusinessRentalItemActivityScope) => {
      const next = await rentalsApi.getBusinessItemActivity(itemId, {
        scope: nextScope,
        limit: 50,
      });
      if (!next) throw new Error('activity');
      return next;
    },
    [itemId]
  );

  const load = useCallback(
    async (opts?: { soft?: boolean; nextScope?: BusinessRentalItemActivityScope }) => {
      if (!opts?.soft) setLoading(true);
      setError(false);
      try {
        const requested = opts?.nextScope ?? scope;
        let next = await fetchActivity(requested);
        if (!suggestedApplied.current) {
          suggestedApplied.current = true;
          if (next.suggestedScope !== requested) {
            setScope(next.suggestedScope);
            next = await fetchActivity(next.suggestedScope);
          } else {
            setScope(requested);
          }
        }
        setData(next);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [fetchActivity, scope]
  );

  useEffect(() => {
    void load();
    // Initial load only; scope changes go through onScopeChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ soft: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onScopeChange = useCallback(
    (next: string) => {
      const value = next as BusinessRentalItemActivityScope;
      setScope(value);
      void load({ soft: true, nextScope: value });
    },
    [load]
  );

  if (loading && !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, padding: spacing.md }]}>
        <Text style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
          {t('business.rentals.activity.loadError', 'Could not load rental activity')}
        </Text>
        <Button mode="contained" onPress={() => void load()}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      data={data?.bookings ?? []}
      keyExtractor={(row) => row.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          colors={[colors.primary.main]}
          tintColor={colors.primary.main}
        />
      }
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.md, gap: spacing.sm }}>
          <Text variant="titleLarge" style={{ color: colors.text.primary }}>
            {data?.item.name || t('business.rentals.activity.title', 'Rental activity')}
          </Text>
          {data?.stats ? <RentalItemActivityStatsStrip stats={data.stats} /> : null}
          {data?.stats.openRequests ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t('business.rentals.activity.openRequests', '{{count}} open request(s)', {
                count: data.stats.openRequests,
              })}
            </Text>
          ) : null}
          <SegmentedButtons
            value={scope}
            onValueChange={onScopeChange}
            buttons={[
              {
                value: 'upcoming',
                label: t('business.rentals.activity.scopeUpcoming', 'Upcoming'),
              },
              {
                value: 'past',
                label: t('business.rentals.activity.scopePast', 'Past'),
              },
              {
                value: 'all',
                label: t('business.rentals.activity.scopeAll', 'All'),
              },
            ]}
          />
        </View>
      }
      ListEmptyComponent={
        <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 24 }}>
          {t('business.rentals.activity.empty', 'No rentals in this filter yet.')}
        </Text>
      }
      renderItem={({ item }) => (
        <ActivityBookingRow
          row={item}
          onPress={() =>
            navigation.navigate('BusinessRentalBookingDetail', { bookingId: item.id })
          }
          colors={colors}
          spacing={spacing}
          borderRadius={borderRadius}
          shadows={shadows}
        />
      )}
    />
  );
}

function ActivityBookingRow({
  row,
  onPress,
  colors,
  spacing,
  borderRadius,
  shadows,
}: {
  row: BusinessRentalItemActivityBooking;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  borderRadius: ReturnType<typeof useTheme>['borderRadius'];
  shadows: ReturnType<typeof useTheme>['shadows'];
}) {
  const { t } = useTranslation();
  const client = row.rental_request?.client?.user;
  const name = [client?.first_name, client?.last_name].filter(Boolean).join(' ');
  const place = row.rental_location_listing?.business_location?.name;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={styles.rowBetween}>
        <Text
          style={{ color: colors.text.primary, fontWeight: '600', flex: 1, minWidth: 0 }}
          numberOfLines={1}
        >
          {name || t('business.rentals.schedule.client', 'Client')}
        </Text>
        <RentalPhaseStatusPill bookingStatus={row.status} role="business" />
      </View>
      {place ? (
        <Text style={{ color: colors.text.secondary, marginTop: 4, fontSize: 13 }} numberOfLines={1}>
          {place}
        </Text>
      ) : null}
      <Text style={{ color: colors.text.secondary, marginTop: 4, fontSize: 13 }}>
        {formatRentalRequestLocalDateTime(row.start_at)} →{' '}
        {formatRentalRequestLocalDateTime(row.end_at)}
      </Text>
      <Text style={{ color: colors.text.primary, marginTop: 4, fontWeight: '600' }}>
        {formatRentalMoney(
          Number(row.total_amount) + Number(row.overtime_amount ?? 0),
          row.currency
        )}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
