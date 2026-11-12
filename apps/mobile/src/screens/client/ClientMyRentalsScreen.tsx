import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Dialog, Portal, Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClientRentalRequestRow as ClientRentalRequestRowView } from '../../components/rentals/ClientRentalRequestRow';
import { MyRentalsHeader } from '../../components/rentals/MyRentalsHeader';
import { RentalHubTabs } from '../../components/rentals/RentalHubTabs';
import { RentalBookConfirmSheet } from '../../components/rentals/RentalBookConfirmSheet';
import { StatusPill } from '../../components/common/StatusPill';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useBookRental } from '../../hooks/useBookRental';
import { useClientRentalBookings } from '../../hooks/useClientRentalBookings';
import { useClientRentalRequests } from '../../hooks/useClientRentalRequests';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import {
  settleRentalStripePayment,
  useRentalStripePayment,
} from '../../hooks/useRentalStripePayment';
import type { ClientRootStackParamList } from '../../navigation/types';
import type {
  ClientRentalBookingRow,
  ClientRentalRequestRow,
} from '../../types/rentals';
import {
  formatRentalMoney,
  formatRentalRequestLocalDateTime,
  isProposedContractOpen,
  rentalPhaseColors,
  resolveRentalPhase,
  parseRentalSelectionWindows,
  type RentalHubGroup,
} from '../../utils/rentals';
import { leaveMyRentals } from '../../utils/rentals/leaveMyRentals';
import { rentalEditWindowOpen } from '../../utils/rentals/rentalRequestFormat';

type HubSegment = RentalHubGroup;

function modifyStateFor(row: ClientRentalRequestRow, enabled: boolean): 'hidden' | 'open' | 'closed' {
  if (!enabled || row.status !== 'pending') return 'hidden';
  const windows = parseRentalSelectionWindows(row.rental_selection_windows);
  const start = windows[0]?.start_at;
  if (start && !rentalEditWindowOpen(start)) return 'closed';
  return 'open';
}

function countHub(
  requests: ClientRentalRequestRow[],
  bookings: ClientRentalBookingRow[],
  group: RentalHubGroup
): number {
  const linked = new Set(requests.map((row) => row.rental_booking?.id).filter(Boolean));
  let count = 0;
  for (const row of requests) {
    if (resolveRentalPhase({ requestStatus: row.status, bookingStatus: row.rental_booking?.status ?? null }, 'client').hubGroup === group) {
      count += 1;
    }
  }
  for (const row of bookings) {
    if (linked.has(row.id)) continue;
    if (resolveRentalPhase({ bookingStatus: row.status }, 'client').hubGroup === group) count += 1;
  }
  return count;
}

export default function ClientMyRentalsScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const route = useRoute<RouteProp<ClientRootStackParamList, 'ClientMyRentals'>>();
  const { flags } = useClientFlags();
  const [hubSegment, setHubSegment] = useState<HubSegment>('action_needed');
  const [snack, setSnack] = useState<string | null>(null);
  const [bookRow, setBookRow] = useState<ClientRentalRequestRow | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  useEffect(() => {
    if (route.params?.notice !== 'updated') return;
    setSnack(t('rentals.modify.saved', 'Request updated'));
    navigation.setParams({ notice: undefined });
  }, [navigation, route.params?.notice, t]);

  useEffect(() => {
    const segment = route.params?.segment;
    if (segment !== 'action_needed' && segment !== 'upcoming' && segment !== 'past') return;
    setHubSegment(segment);
  }, [route.params?.segment]);

  const onBack = useCallback(() => {
    leaveMyRentals(navigation);
  }, [navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const {
    requests,
    loading: requestsLoading,
    error: requestsError,
    refetch: refetchRequests,
    cancel,
    cancellingId,
  } = useClientRentalRequests();
  const {
    bookings,
    loading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useClientRentalBookings();
  const { book, loading: bookingLoading } = useBookRental();
  const {
    isStripeRail,
    loading: stripeRailLoading,
    refetch: refetchStripeRail,
  } = useIsStripeRail();
  const { pay: payWithSheet, loading: sheetLoading } = useRentalStripePayment();

  const hubItems = useMemo(() => {
    const bookingIdsFromRequests = new Set<string>();
    type HubItem =
      | { kind: 'request'; row: ClientRentalRequestRow; sortAt: number }
      | { kind: 'booking'; row: ClientRentalBookingRow; sortAt: number };

    const items: HubItem[] = [];
    for (const row of requests) {
      const bookingStatus = row.rental_booking?.status ?? null;
      if (row.rental_booking?.id) bookingIdsFromRequests.add(row.rental_booking.id);
      const info = resolveRentalPhase(
        { requestStatus: row.status, bookingStatus },
        'client'
      );
      if (info.hubGroup !== hubSegment) continue;
      items.push({
        kind: 'request',
        row,
        sortAt: new Date(row.created_at).getTime() || 0,
      });
    }
    for (const row of bookings) {
      if (bookingIdsFromRequests.has(row.id)) continue;
      const info = resolveRentalPhase({ bookingStatus: row.status }, 'client');
      if (info.hubGroup !== hubSegment) continue;
      items.push({
        kind: 'booking',
        row,
        sortAt: new Date(row.start_at).getTime() || 0,
      });
    }
    return items.sort((a, b) => b.sortAt - a.sortAt);
  }, [bookings, hubSegment, requests]);

  const toDoCount = useMemo(() => countHub(requests, bookings, 'action_needed'), [bookings, requests]);

  const onRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([refetchRequests(), refetchBookings()]);
    } finally {
      setPullRefreshing(false);
    }
  }, [refetchBookings, refetchRequests]);

  const confirmBook = useCallback(async () => {
    if (!bookRow) return;
    if (!isProposedContractOpen(bookRow)) {
      setSnack(
        t(
          'rentals.clientRequests.contractExpiredBookError',
          'This offer has expired. Send a new request from the listing.'
        )
      );
      setBookRow(null);
      return;
    }
    try {
      const usePaymentSheet = stripeRailLoading
        ? await refetchStripeRail()
        : isStripeRail;
      const res = await book(
        bookRow.id,
        usePaymentSheet ? { stripe_payment_method: 'payment_sheet' } : undefined
      );
      const stripeOutcome = await settleRentalStripePayment(res, payWithSheet);
      if (stripeOutcome === 'cancelled') {
        setSnack(
          t('client.rentals.paymentCancelled', 'Payment cancelled. You can retry from the booking.')
        );
      } else if (stripeOutcome === 'failed') {
        setSnack(t('client.rentals.paymentFailed', 'Payment failed. You can retry from the booking.'));
      } else if (stripeOutcome === 'success' || stripeOutcome === 'authorized') {
        setSnack(t('client.rentals.paymentConfirmed', 'Payment confirmed'));
      } else if (stripeOutcome === 'pending') {
        setSnack(
          t(
            'client.rentals.paymentConfirming',
            'Payment received. Confirming your booking…'
          )
        );
      } else if (stripeOutcome === 'browser') {
        setSnack(
          t(
            'client.rentals.paymentPendingStripe',
            'Complete card payment to confirm your booking.'
          )
        );
      } else if (res.reserved) {
        setSnack(
          t(
            'rentals.clientRequests.bookReserved',
            'Reserved — pay at pickup to start your rental'
          )
        );
      } else {
        setSnack(t('rentals.clientRequests.bookSuccess', 'Booking created'));
      }
      setBookRow(null);
      await Promise.all([refetchRequests(), refetchBookings()]);
      if (res.bookingId) {
        navigation.navigate('RentalBookingDetail', { bookingId: res.bookingId });
      }
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('rentals.clientRequests.bookError', 'Could not complete booking')
      );
    }
  }, [
    book,
    bookRow,
    isStripeRail,
    navigation,
    payWithSheet,
    refetchBookings,
    refetchRequests,
    refetchStripeRail,
    stripeRailLoading,
    t,
  ]);

  const confirmCancel = useCallback(async () => {
    if (!cancelId) return;
    try {
      await cancel(cancelId);
      setCancelId(null);
      setSnack(t('rentals.clientRequests.cancelSuccess', 'Request cancelled'));
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('rentals.clientRequests.cancelError', 'Could not cancel request')
      );
    }
  }, [cancel, cancelId, t]);

  const renderRequest = useCallback(
    ({ item }: { item: ClientRentalRequestRow }) => (
      <ClientRentalRequestRowView
        row={item}
        bookingLoading={bookingLoading && bookRow?.id === item.id}
        cancelling={cancellingId === item.id}
        onBookRequest={(id) => {
          const row = requests.find((r) => r.id === id) ?? null;
          setBookRow(row);
        }}
        onCancel={(id) => setCancelId(id)}
        onViewListing={(listingId) => navigation.navigate('RentalListingDetail', { listingId })}
        onViewBooking={(bookingId) => navigation.navigate('RentalBookingDetail', { bookingId })}
        modifyState={modifyStateFor(item, flags.rentals_modify_request_enabled)}
        onModify={(id) => navigation.navigate('ModifyRentalRequest', { requestId: id })}
        onContact={(bookingId) => navigation.navigate('RentalBookingDetail', { bookingId })}
      />
    ),
    [bookRow?.id, bookingLoading, cancellingId, flags.rentals_modify_request_enabled, navigation, requests]
  );

  const renderBooking = useCallback(
    ({ item }: { item: ClientRentalBookingRow }) => {
      const phase = resolveRentalPhase({ bookingStatus: item.status }, 'client');
      const statusColors = rentalPhaseColors(phase.phase, colors);
      const name =
        item.rental_location_listing?.rental_item?.name ??
        t('rentals.clientRequests.unknownItem', 'Rental');
      const imageUri =
        item.rental_location_listing?.rental_item?.rental_item_images?.[0]?.image_url;
      return (
        <Pressable
          onPress={() => navigation.navigate('RentalBookingDetail', { bookingId: item.id })}
          style={[
            styles.bookingCard,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              marginBottom: spacing.sm,
            },
          ]}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.bookingImage} resizeMode="cover" />
          ) : (
            <View style={[styles.bookingImage, { backgroundColor: colors.disabled }]} />
          )}
          <View style={{ flex: 1, minWidth: 0, padding: spacing.sm }}>
            <Text style={[typography.subtitle2, { color: colors.text.primary }]} numberOfLines={2}>
              {name}
            </Text>
            {item.booking_number ? (
              <Text style={[typography.caption, { color: colors.text.secondary }]}>
                {item.booking_number}
              </Text>
            ) : null}
            <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]}>
              {formatRentalRequestLocalDateTime(item.start_at)} —{' '}
              {formatRentalRequestLocalDateTime(item.end_at)}
            </Text>
            {phase.nextStepKey ? (
              <Text
                style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}
                numberOfLines={2}
              >
                {t(phase.nextStepKey, '')}
              </Text>
            ) : null}
            <View style={[styles.bookingFooter, { marginTop: spacing.xs }]}>
              <StatusPill
                label={t(phase.labelKey, item.status)}
                backgroundColor={statusColors.backgroundColor}
                textColor={statusColors.textColor}
                borderColor={statusColors.borderColor}
                compact
              />
              <Text style={[typography.caption, { color: colors.text.primary, fontWeight: '700' }]}>
                {formatRentalMoney(item.total_amount, item.currency || 'XAF')}
              </Text>
            </View>
            {item.status === 'completed' ? (
              <Button
                mode="text"
                compact
                onPress={() => navigation.navigate('RentalRateBooking', { bookingId: item.id })}
              >
                {t('rentals.actions.rate', 'Rate rental')}
              </Button>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [borderRadius.md, colors, navigation, shadows.sm, spacing, t, typography]
  );

  const loading = requestsLoading || bookingsLoading;
  const error = requestsError || bookingsError;

  return (
    <View style={[styles.safe, { backgroundColor: colors.pageBackground, paddingTop: insets.top }]}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <MyRentalsHeader
          title={t('rentals.hub.title', 'My rentals')}
          backLabel={t('common.back', 'Back')}
          onBack={onBack}
        />
        <RentalHubTabs
          value={hubSegment}
          onChange={setHubSegment}
          tabs={[
            { value: 'action_needed', label: t('rentals.hub.toDo', 'To do'), count: toDoCount },
            { value: 'upcoming', label: t('rentals.hub.upcoming', 'Upcoming') },
            { value: 'past', label: t('rentals.hub.past', 'Past') },
          ]}
        />
        <View style={{ height: spacing.sm }} />
        {error ? (
          <View
            style={[
              styles.errorBanner,
              { borderColor: colors.error.main, backgroundColor: colors.surface },
            ]}
          >
            <Text style={{ color: colors.error.main, flex: 1 }}>{error}</Text>
            <Button mode="text" compact onPress={() => void onRefresh()}>
              {t('common.retry', 'Retry')}
            </Button>
          </View>
        ) : null}
      </View>

      <FlatList
        data={hubItems}
        keyExtractor={(item) => `${item.kind}-${item.row.id}`}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: insets.bottom + spacing.lg,
          flexGrow: hubItems.length === 0 ? 1 : undefined,
        }}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={() => void onRefresh()}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
        renderItem={({ item }) =>
          item.kind === 'request'
            ? renderRequest({ item: item.row })
            : renderBooking({ item: item.row })
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary.main} />
          ) : (
            <View style={styles.empty}>
              <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center' }]}>
                {hubSegment === 'action_needed'
                  ? t(
                      'rentals.hub.emptyActionNeeded',
                      'Nothing needs your attention right now.'
                    )
                  : hubSegment === 'upcoming'
                    ? t('rentals.hub.emptyUpcoming', 'No upcoming rentals.')
                    : t('rentals.hub.emptyPast', 'No past rentals yet.')}
              </Text>
              <Button
                mode="contained-tonal"
                style={{ marginTop: spacing.md }}
                onPress={() =>
                  navigation.navigate('ClientMainTabs', {
                    screen: 'ClientBrowse',
                    params: { segment: 'rentals' },
                  })
                }
              >
                {t('rentals.clientRequests.browseRentals', 'Browse rentals')}
              </Button>
            </View>
          )
        }
      />

      <RentalBookConfirmSheet
        visible={!!bookRow}
        row={bookRow}
        loading={bookingLoading || sheetLoading}
        isStripeRail={isStripeRail}
        onDismiss={() => setBookRow(null)}
        onConfirm={() => void confirmBook()}
      />

      <Portal>
        <Dialog visible={!!cancelId} onDismiss={() => setCancelId(null)}>
          <Dialog.Title>
            {t('rentals.clientRequests.cancelConfirmTitle', 'Cancel this request?')}
          </Dialog.Title>
          <Dialog.Content>
            <Text>
              {t(
                'rentals.clientRequests.cancelConfirmMessage',
                'The business will no longer see this request. You can send a new request later if you change your mind.'
              )}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCancelId(null)}>{t('common.cancel', 'Cancel')}</Button>
            <Button onPress={() => void confirmCancel()} textColor={colors.error.main}>
              {t('rentals.clientRequests.cancelRequest', 'Cancel request')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3500}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  empty: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 },
  bookingCard: {
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  bookingImage: { width: 88, alignSelf: 'stretch' },
  bookingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
