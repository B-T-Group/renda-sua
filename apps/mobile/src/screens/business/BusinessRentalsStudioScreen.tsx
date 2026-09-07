import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Button,
  FAB,
  Searchbar,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BusinessRentalCatalogCard } from '../../components/business/rentals/BusinessRentalCatalogCard';
import { BusinessRentalRespondDialog } from '../../components/business/rentals/BusinessRentalRespondDialog';
import { ModerationFilterBanner } from '../../components/common/ModerationFilterBanner';
import { StatusPill } from '../../components/common/StatusPill';
import { RentalPhaseStatusPill } from '../../components/common/RentalPhaseStatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { rentalsApi } from '../../services/rentalsApi';
import type { BusinessRootStackParamList } from '../../navigation/types';
import {
  useMainTabContentBottomPadding,
  useTabBarOverlayHeight,
} from '../../hooks/useMainTabContentBottomPadding';
import type {
  BusinessRentalItemRow,
  BusinessRentalRequestRow,
  BusinessRentalScheduleRow,
} from '../../types/rentals';
import {
  formatRentalMoney,
  formatRentalRequestLocalDateTime,
  matchesBusinessQueue,
  rentalItemMatchesModerationFilter,
  rentalPhaseColors,
  resolveRentalPhase,
  type BusinessActionQueue,
  type RentalModerationFilter,
} from '../../utils/rentals';

type Tab = 'catalog' | 'requests' | 'schedule';
type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;
type RentalsRouteParams = NonNullable<
  BusinessRootStackParamList['BusinessRentalsStudio']
>;
type ModerationFilter = NonNullable<RentalsRouteParams['moderationStatus']>;

function rentalItemMatchesSearch(item: BusinessRentalItemRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = item.name?.toLowerCase() ?? '';
  const description = item.description?.toLowerCase() ?? '';
  return name.includes(q) || description.includes(q);
}

const QUEUE_FILTERS: BusinessActionQueue[] = [
  'respond',
  'collect_pay',
  'start',
  'return',
  'all',
];

export default function BusinessRentalsStudioScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const listBottomPadding = useMainTabContentBottomPadding(88);
  const tabBarHeight = useTabBarOverlayHeight();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const routeParams = (route.params ?? {}) as RentalsRouteParams;
  const isCatalogTab = route.name === 'BusinessCatalog';
  const fabBottom = (isCatalogTab ? tabBarHeight : insets.bottom) + 16;
  const moderationStatus = routeParams?.moderationStatus;
  const [tab, setTab] = useState<Tab>(routeParams?.tab ?? 'catalog');
  const [searchDraft, setSearchDraft] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchDraft), 300);
    return () => clearTimeout(id);
  }, [searchDraft]);

  useEffect(() => {
    const next = routeParams?.tab;
    if (next === 'catalog' || next === 'requests' || next === 'schedule') {
      setTab(next);
    }
  }, [routeParams?.tab]);

  useEffect(() => {
    if (moderationStatus) {
      setTab('catalog');
    }
  }, [moderationStatus]);

  const clearModerationFilter = useCallback(() => {
    navigation.setParams({ moderationStatus: undefined });
  }, [navigation]);

  const [items, setItems] = useState<BusinessRentalItemRow[]>([]);
  const [requests, setRequests] = useState<BusinessRentalRequestRow[]>([]);
  const [scheduleItemId, setScheduleItemId] = useState('');
  const [schedule, setSchedule] = useState<BusinessRentalScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respondMode, setRespondMode] = useState<'available' | 'unavailable' | null>(
    null
  );
  const [respondReq, setRespondReq] = useState<BusinessRentalRequestRow | null>(null);

  const loadCatalog = useCallback(async () => {
    const list = await rentalsApi.getBusinessItems();
    setItems(list.filter((i) => !i.deleted_at));
    if (!scheduleItemId && list[0]?.id) setScheduleItemId(list[0].id);
  }, [scheduleItemId]);

  const loadRequests = useCallback(async () => {
    const list = await rentalsApi.getBusinessRequests();
    setRequests(list);
  }, []);

  const loadSchedule = useCallback(async () => {
    if (!scheduleItemId) {
      setSchedule([]);
      return;
    }
    const list = await rentalsApi.getBusinessSchedule(scheduleItemId);
    setSchedule(list);
  }, [scheduleItemId]);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([loadCatalog(), loadRequests(), loadSchedule()]);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : t('business.rentals.loadError', 'Could not load rentals')
      );
    }
  }, [loadCatalog, loadRequests, loadSchedule, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadAll();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  useFocusEffect(
    useCallback(() => {
      void loadCatalog();
    }, [loadCatalog])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const [queueFilter, setQueueFilter] = useState<BusinessActionQueue>('all');

  const queuedRequests = useMemo(() => {
    return requests.filter((r) => {
      if (r.status === 'unavailable') return queueFilter === 'all';
      const info = resolveRentalPhase(
        {
          requestStatus: r.status,
          bookingStatus: r.rental_booking?.status ?? null,
        },
        'business'
      );
      return matchesBusinessQueue(info, queueFilter);
    });
  }, [queueFilter, requests]);

  const filteredCatalogItems = useMemo(() => {
    const list = items.filter((item) => {
      if (
        moderationStatus &&
        !rentalItemMatchesModerationFilter(item, moderationStatus as RentalModerationFilter)
      ) {
        return false;
      }
      return rentalItemMatchesSearch(item, debouncedSearch);
    });
    if (!moderationStatus) return list;
    return [...list].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [debouncedSearch, items, moderationStatus]);

  const moderationBanner = moderationStatus ? (
    <ModerationFilterBanner
      message={
        moderationStatus === 'rejected'
          ? t(
              'business.rentals.rejectedFilterBanner',
              'Showing rentals that need updates after rejection.'
            )
          : t(
              'business.rentals.proposalFilterBanner',
              'Showing rentals with AI suggestions ready to review.'
            )
      }
      onClear={clearModerationFilter}
      clearLabel={t('business.rentals.clearFilter', 'Show all')}
    />
  ) : null;

  const emptyForModeration = (status: ModerationFilter) =>
    status === 'rejected'
      ? t(
          'business.rentals.emptyRejected',
          'No rejected rentals in your catalog. If this action still appears, pull to refresh the dashboard.'
        )
      : t(
          'business.rentals.emptyProposal',
          'No rentals with AI suggestions right now. Pull to refresh the dashboard if needed.'
        );

  const catalogListHeader = (
    <View style={{ marginBottom: spacing.sm, gap: spacing.sm }}>
      {moderationBanner}
      <Searchbar
        placeholder={t('business.rentals.catalog.searchPlaceholder', 'Search rentals')}
        value={searchDraft}
        onChangeText={setSearchDraft}
        style={{ backgroundColor: colors.surface }}
      />
    </View>
  );

  const catalogEmptyMessage = useMemo(() => {
    if (debouncedSearch.trim()) {
      return t('business.rentals.catalog.noSearchResults', 'No rentals match your search.');
    }
    if (moderationStatus === 'rejected') {
      return t(
        'business.rentals.emptyRejected',
        'No rejected rentals in your catalog. If this action still appears, pull to refresh the dashboard.'
      );
    }
    if (moderationStatus === 'proposal_pending') {
      return t(
        'business.rentals.emptyProposal',
        'No rentals with AI suggestions right now. Pull to refresh the dashboard if needed.'
      );
    }
    return t('business.rentals.catalog.empty', 'No rental items yet.');
  }, [debouncedSearch, moderationStatus, t]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      colors={[colors.primary.main]}
      tintColor={colors.primary.main}
    />
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          buttons={[
            {
              value: 'catalog',
              label: t('business.rentals.tabs.catalog', 'Catalog'),
            },
            {
              value: 'requests',
              label: t('business.rentals.tabs.requests', 'Requests'),
            },
            {
              value: 'schedule',
              label: t('business.rentals.tabs.schedule', 'Schedule'),
            },
          ]}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary.main} />
      ) : null}

      {error && !loading ? (
        <View style={{ padding: spacing.md }}>
          <Text style={{ color: colors.error.main, marginBottom: 12 }}>{error}</Text>
          <Button mode="contained" onPress={() => void onRefresh()}>
            {t('common.retry', 'Retry')}
          </Button>
        </View>
      ) : null}

      {!loading && !error && tab === 'catalog' ? (
        <FlatList
          data={filteredCatalogItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: listBottomPadding,
          }}
          refreshControl={refreshControl}
          ListHeaderComponent={catalogListHeader}
          ListEmptyComponent={
            <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 40 }}>
              {catalogEmptyMessage}
            </Text>
          }
          renderItem={({ item }) => (
            <BusinessRentalCatalogCard
              item={item}
              onPress={(id) =>
                navigation.navigate('BusinessRentalItemDetail', { itemId: id })
              }
              onReviewProposal={(listingId) =>
                navigation.navigate('BusinessRentalAiProposal', { listingId })
              }
            />
          )}
        />
      ) : null}

      {!loading && !error && tab === 'requests' ? (
        <FlatList
          data={queuedRequests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: Math.max(listBottomPadding - 64, insets.bottom + 24),
          }}
          refreshControl={refreshControl}
          ListEmptyComponent={
            <View style={{ marginTop: 40 }}>
              <Text
                style={[
                  typography.subtitle1,
                  { color: colors.text.primary, textAlign: 'center' },
                ]}
              >
                {requests.length === 0
                  ? t('business.rentals.emptyRequestsTitle', 'No booking requests')
                  : t('business.rentals.emptyQueue', 'No items in this queue.')}
              </Text>
              <Text
                style={{
                  color: colors.text.secondary,
                  textAlign: 'center',
                  marginTop: 8,
                }}
              >
                {requests.length === 0
                  ? t(
                      'business.rentals.emptyRequestsBody',
                      'When customers request your rentals, they will appear here.'
                    )
                  : t(
                      'business.rentals.emptyQueueHint',
                      'Try another queue filter.'
                    )}
              </Text>
            </View>
          }
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.md, gap: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {QUEUE_FILTERS.map((q) => {
                  const selected = queueFilter === q;
                  const labelKey =
                    q === 'collect_pay'
                      ? 'rentals.queue.collectPay'
                      : `rentals.queue.${q === 'respond' ? 'respond' : q === 'start' ? 'start' : q === 'return' ? 'return' : 'all'}`;
                  const defaults: Record<string, string> = {
                    'rentals.queue.respond': 'Respond',
                    'rentals.queue.collectPay': 'Collect pay',
                    'rentals.queue.start': 'Start',
                    'rentals.queue.return': 'Return',
                    'rentals.queue.all': 'All',
                  };
                  return (
                    <Pressable
                      key={q}
                      onPress={() => setQueueFilter(q)}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? colors.primary.main : colors.divider,
                          backgroundColor: selected
                            ? colors.primaryTint
                            : colors.surface,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: selected ? colors.primary.main : colors.text.primary,
                          fontSize: 13,
                          fontWeight: '600',
                        }}
                      >
                        {t(labelKey, defaults[labelKey] ?? q)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const phase = resolveRentalPhase(
              {
                requestStatus: item.status,
                bookingStatus: item.rental_booking?.status ?? null,
              },
              'business'
            );
            const sc = rentalPhaseColors(phase.phase, colors);
            const client = item.client?.user;
            const name = [client?.first_name, client?.last_name]
              .filter(Boolean)
              .join(' ');
            const bookingId = item.rental_booking?.id;
            const primaryQueue = phase.businessQueue;
            return (
              <View
                style={[
                  styles.reqCard,
                  {
                    borderColor: colors.divider,
                    backgroundColor: colors.surface,
                    marginBottom: spacing.md,
                    padding: spacing.md,
                  },
                ]}
              >
                <View style={styles.rowBetween}>
                  <Text
                    style={[typography.subtitle2, { color: colors.text.primary, flex: 1 }]}
                    numberOfLines={2}
                  >
                    {item.rental_location_listing.rental_item.name}
                  </Text>
                  <StatusPill
                    compact
                    label={t(phase.labelKey, item.status)}
                    backgroundColor={sc.backgroundColor}
                    textColor={sc.textColor}
                    borderColor={sc.borderColor}
                  />
                </View>
                {name ? (
                  <Text style={{ color: colors.text.secondary, marginTop: 4 }}>
                    {name}
                  </Text>
                ) : null}
                {phase.nextStepKey ? (
                  <Text
                    style={{ color: colors.text.secondary, marginTop: 4, fontSize: 12 }}
                    numberOfLines={2}
                  >
                    {t(phase.nextStepKey, '')}
                  </Text>
                ) : null}
                <Text style={{ color: colors.text.secondary, marginTop: 4, fontSize: 12 }}>
                  {formatRentalRequestLocalDateTime(item.created_at)}
                </Text>
                {item.status === 'pending' ? (
                  <View style={styles.actions}>
                    <Button
                      mode="contained"
                      compact
                      onPress={() => {
                        setRespondReq(item);
                        setRespondMode('available');
                      }}
                    >
                      {t('rentals.actions.accept', 'Accept')}
                    </Button>
                    <Button
                      mode="outlined"
                      compact
                      onPress={() => {
                        setRespondReq(item);
                        setRespondMode('unavailable');
                      }}
                    >
                      {t('rentals.actions.decline', 'Decline')}
                    </Button>
                  </View>
                ) : bookingId ? (
                  <Button
                    mode="contained"
                    style={{ marginTop: 8 }}
                    onPress={() =>
                      navigation.navigate('BusinessRentalBookingDetail', {
                        bookingId,
                      })
                    }
                  >
                    {primaryQueue === 'collect_pay'
                      ? t('rentals.actions.collectPayment', 'Collect payment')
                      : primaryQueue === 'start'
                        ? t('rentals.actions.verifyStartPin', 'Verify start PIN')
                        : primaryQueue === 'return'
                          ? t('rentals.actions.confirmReturn', 'Confirm return')
                          : t('rentals.actions.openBooking', 'Open booking')}
                  </Button>
                ) : null}
              </View>
            );
          }}
        />
      ) : null}

      {!loading && !error && tab === 'schedule' ? (
        <FlatList
          data={schedule}
          keyExtractor={(row) => row.id}
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: Math.max(listBottomPadding - 64, insets.bottom + 24),
          }}
          refreshControl={refreshControl}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.md }}>
              <Text
                style={[typography.body2, { color: colors.text.secondary, marginBottom: 8 }]}
              >
                {t('business.rentals.schedule.pickItem', 'Rental item')}
              </Text>
              <View style={styles.itemChips}>
                {items.map((it) => (
                  <Pressable
                    key={it.id}
                    onPress={() => setScheduleItemId(it.id)}
                    style={[
                      styles.chip,
                      {
                        borderColor:
                          scheduleItemId === it.id
                            ? colors.primary.main
                            : colors.divider,
                        backgroundColor:
                          scheduleItemId === it.id
                            ? colors.primaryTint
                            : colors.surface,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color:
                          scheduleItemId === it.id
                            ? colors.primary.main
                            : colors.text.primary,
                        fontSize: 13,
                      }}
                    >
                      {it.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 24 }}>
              {t('business.rentals.schedule.empty', 'No upcoming bookings for this item.')}
            </Text>
          }
          renderItem={({ item: row }) => {
            const client = row.rental_request?.client?.user;
            const name = [client?.first_name, client?.last_name]
              .filter(Boolean)
              .join(' ');
            return (
              <Pressable
                onPress={() =>
                  navigation.navigate('BusinessRentalBookingDetail', {
                    bookingId: row.id,
                  })
                }
                style={[
                  styles.reqCard,
                  {
                    borderColor: colors.divider,
                    backgroundColor: colors.surface,
                    marginBottom: spacing.sm,
                    padding: spacing.md,
                  },
                ]}
              >
                <View style={styles.rowBetween}>
                  <Text style={{ color: colors.text.primary, fontWeight: '600', flex: 1 }}>
                    {name || t('business.rentals.schedule.client', 'Client')}
                  </Text>
                  <RentalPhaseStatusPill bookingStatus={row.status} role="business" />
                </View>
                <Text style={{ color: colors.text.secondary, marginTop: 4, fontSize: 13 }}>
                  {formatRentalRequestLocalDateTime(row.start_at)} →{' '}
                  {formatRentalRequestLocalDateTime(row.end_at)}
                </Text>
                <Text style={{ color: colors.text.secondary, marginTop: 2, fontSize: 13 }}>
                  {formatRentalMoney(row.total_amount, row.currency)}
                </Text>
              </Pressable>
            );
          }}
        />
      ) : null}

      {tab === 'catalog' ? (
        <FAB
          icon="plus"
          style={[styles.fab, { bottom: fabBottom, backgroundColor: colors.primary.main }]}
          color="#fff"
          onPress={() => navigation.navigate('BusinessAddRentalFromImage')}
          label={t('business.rentals.add', 'Add rental')}
        />
      ) : null}

      <BusinessRentalRespondDialog
        visible={!!respondMode && !!respondReq}
        mode={respondMode}
        request={respondReq}
        onDismiss={() => {
          setRespondMode(null);
          setRespondReq(null);
        }}
        onSuccess={() => void loadRequests()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  reqCard: { borderWidth: 1, borderRadius: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  fab: { position: 'absolute', right: 16 },
  itemChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
});
