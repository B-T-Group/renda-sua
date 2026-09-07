import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Dialog, Portal, Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageLightbox } from '../../components/common/ImageLightbox';
import { StatusPill } from '../../components/common/StatusPill';
import { OrderMessageComposer } from '../../components/messaging/OrderMessageComposer';
import { RentalPhaseBanner } from '../../components/rentals/RentalPhaseBanner';
import { SendRentalStartPinButton } from '../../components/rentals/SendRentalStartPinButton';
import { useTheme } from '../../contexts/ThemeContext';
import { useRentalBookingDetail } from '../../hooks/useRentalBookingDetail';
import { useRentalBookingMessages } from '../../hooks/useRentalBookingMessages';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import {
  settleRentalStripePayment,
  useRentalStripePayment,
} from '../../hooks/useRentalStripePayment';
import type { ClientRootStackParamList } from '../../navigation/types';
import type { RentalBookingStatus } from '../../types/rentals';
import {
  formatRentalMoney,
  formatRentalRequestLocalDateTime,
  parseRentalPricingSnapshot,
  parseRentalSelectionWindows,
  rentalBookingStatusColors,
  resolveBookingPhase,
} from '../../utils/rentals';

type Params = { RentalBookingDetail: { bookingId: string } };

const PHASE_DEFAULTS: Record<string, string> = {
  'rentals.phases.requested': 'Requested',
  'rentals.phases.offerReady': 'Offer ready',
  'rentals.phases.reserved': 'Reserved',
  'rentals.phases.readyForPickup': 'Ready for pickup',
  'rentals.phases.inProgress': 'In progress',
  'rentals.phases.done': 'Done',
};

const TIMELINE: RentalBookingStatus[] = [
  'proposed',
  'confirmed',
  'active',
  'awaiting_return',
  'completed',
];

/** Reserved (pay-at-pickup) bookings get their own step between proposed and confirmed. */
function timelineFor(status: string): RentalBookingStatus[] {
  if (status !== 'reserved') return TIMELINE;
  return [
    'proposed',
    'reserved',
    'confirmed',
    'active',
    'awaiting_return',
    'completed',
  ];
}

function statusIndex(steps: RentalBookingStatus[], status: string): number {
  if (status === 'cancelled') return -1;
  const i = steps.indexOf(status as RentalBookingStatus);
  return i >= 0 ? i : 0;
}

function toAmount(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function RentalBookingDetailScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<Params, 'RentalBookingDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const bookingId = route.params?.bookingId;
  const {
    booking,
    paymentStatus,
    loading,
    error,
    actionLoading,
    refetch,
    cancel,
    retryPayment,
    getStartPin,
  } = useRentalBookingDetail(bookingId);
  const {
    isStripeRail,
    loading: stripeRailLoading,
    refetch: refetchStripeRail,
  } = useIsStripeRail();
  const { pay: payWithSheet, loading: sheetLoading } = useRentalStripePayment();
  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    sendMessage,
    refetch: refetchMessages,
    mentionableParticipants,
    markMessagesRead,
  } = useRentalBookingMessages(bookingId ?? '');

  const [pinOpen, setPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchMessages()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchMessages]);

  const formatMessageDate = useCallback((iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }, []);

  const statusColors = rentalBookingStatusColors(booking?.status ?? '', colors);
  const phaseInfo = resolveBookingPhase(booking?.status ?? '', 'client');
  const pricing = parseRentalPricingSnapshot(booking?.rental_pricing_snapshot);
  const windows = parseRentalSelectionWindows(
    booking?.rental_request?.rental_selection_windows
  );
  const timelineSteps = timelineFor(booking?.status ?? '');
  const currentIdx = statusIndex(timelineSteps, booking?.status ?? '');
  const canCancel =
    (booking?.status === 'confirmed' || booking?.status === 'reserved') &&
    !booking?.actual_start_at;
  const canShowPin = booking?.status === 'confirmed';
  const isReserved = booking?.status === 'reserved';
  const depositAmount = toAmount(booking?.security_deposit_amount);
  const authorizedAmount = toAmount(booking?.authorized_amount);
  const overtimeAmount = toAmount(booking?.overtime_amount);
  const isPayAtPickup = booking?.payment_timing === 'pay_at_pickup';
  const paymentPending =
    booking?.status === 'proposed' &&
    (paymentStatus?.paymentPending ?? true);
  const isStripePending =
    paymentStatus?.payment_rail === 'stripe' ||
    (paymentStatus?.payment_rail == null && isStripeRail);

  const bookingImages =
    booking?.rental_location_listing?.rental_item?.rental_item_images ?? [];
  const imageUri = bookingImages[0]?.image_url;

  const onRevealPin = useCallback(async () => {
    try {
      const res = await getStartPin();
      setPinValue(res.pin);
      setPinOpen(true);
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'));
    }
  }, [getStartPin, t]);

  const onRetry = useCallback(async () => {
    try {
      let usePaymentSheet =
        paymentStatus?.payment_rail === 'stripe' || isStripeRail;
      if (paymentStatus?.payment_rail === 'mobile_money') {
        usePaymentSheet = false;
      } else if (!usePaymentSheet && stripeRailLoading) {
        usePaymentSheet = await refetchStripeRail();
      }
      const res = await retryPayment(
        usePaymentSheet ? { stripe_payment_method: 'payment_sheet' } : undefined
      );
      const stripeOutcome = await settleRentalStripePayment(res, payWithSheet);
      if (res.confirmed || stripeOutcome === 'success' || stripeOutcome === 'authorized') {
        setSnack(t('client.rentals.paymentConfirmed', 'Payment confirmed'));
        void refetch();
        return;
      }
      if (stripeOutcome === 'cancelled') {
        setSnack(
          t('client.rentals.paymentCancelled', 'Payment cancelled. You can retry from the booking.')
        );
        return;
      }
      if (stripeOutcome === 'failed') {
        setSnack(t('client.rentals.paymentFailed', 'Payment failed. You can retry from the booking.'));
        return;
      }
      if (stripeOutcome === 'pending') {
        setSnack(
          t(
            'client.rentals.paymentConfirming',
            'Payment received. Confirming your booking…'
          )
        );
        void refetch();
        return;
      }
      if (stripeOutcome === 'browser' || isStripePending) {
        setSnack(
          t(
            'client.rentals.paymentPendingStripe',
            'Complete card payment to confirm your booking.'
          )
        );
        return;
      }
      setSnack(
        t(
          'client.rentals.paymentInitiated',
          'Payment request sent. Confirm on your phone if prompted.'
        )
      );
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'));
    }
  }, [
    isStripePending,
    isStripeRail,
    payWithSheet,
    paymentStatus?.payment_rail,
    refetch,
    refetchStripeRail,
    retryPayment,
    stripeRailLoading,
    t,
  ]);

  const onCancel = useCallback(async () => {
    try {
      await cancel();
      setCancelOpen(false);
      setSnack(t('rentals.cancelled', 'Booking cancelled'));
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'));
    }
  }, [cancel, t]);

  const title = useMemo(
    () =>
      booking?.rental_location_listing?.rental_item?.name ??
      t('rentals.clientRequests.unknownItem', 'Rental'),
    [booking, t]
  );

  if (loading && !booking) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.center, { padding: spacing.lg, backgroundColor: colors.pageBackground }]}>
        <Text style={[typography.h6, { color: colors.text.primary, textAlign: 'center' }]}>
          {error || t('rentals.bookingNotFound', 'Booking not found')}
        </Text>
        <Button mode="contained" style={{ marginTop: spacing.md }} onPress={() => void refetch()}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: insets.bottom + (canShowPin || paymentPending ? 100 : spacing.xl),
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
      >
        {imageUri ? (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={t(
              'public.items.detail.viewFullImage',
              'View full image'
            )}
            onPress={() => {
              setLightboxIdx(0);
              setLightboxOpen(true);
            }}
          >
            <Image
              source={{ uri: imageUri }}
              style={[styles.hero, { borderRadius: borderRadius.md }]}
              resizeMode="cover"
            />
          </Pressable>
        ) : null}

        <View style={[styles.headerRow, { marginTop: spacing.md }]}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: spacing.sm }}>
            <Text style={[typography.h5, { color: colors.text.primary }]}>{title}</Text>
            {booking.booking_number ? (
              <Text style={[typography.caption, { color: colors.text.secondary }]}>
                {booking.booking_number}
              </Text>
            ) : null}
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {booking.rental_location_listing?.business_location?.name ?? ''}
            </Text>
          </View>
          <StatusPill
            label={t(phaseInfo.labelKey, booking.status)}
            backgroundColor={statusColors.backgroundColor}
            textColor={statusColors.textColor}
            borderColor={statusColors.borderColor}
          />
        </View>

        <View style={{ marginTop: spacing.md }}>
          <RentalPhaseBanner
            bookingStatus={booking.status}
            role="client"
            action={
              paymentPending ? (
                <Button
                  mode="contained"
                  loading={actionLoading || sheetLoading}
                  onPress={() => void onRetry()}
                  style={{ marginTop: spacing.xs }}
                >
                  {t('rentals.actions.completePayment', 'Complete payment')}
                </Button>
              ) : canShowPin ? (
                <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                  <SendRentalStartPinButton
                    bookingId={booking.id}
                    onSent={() => void refetchMessages()}
                    onError={(msg) => setSnack(msg)}
                  />
                  <Button
                    mode="outlined"
                    loading={actionLoading}
                    onPress={() => void onRevealPin()}
                  >
                    {t('rentals.actions.showStartPin', 'Show PIN on screen')}
                  </Button>
                </View>
              ) : booking.status === 'completed' ? (
                <Button
                  mode="contained"
                  style={{ marginTop: spacing.xs }}
                  onPress={() =>
                    navigation.navigate('RentalRateBooking', { bookingId: booking.id })
                  }
                >
                  {t('rentals.actions.rate', 'Rate rental')}
                </Button>
              ) : null
            }
          />
        </View>

        {booking.status === 'active' || booking.status === 'awaiting_return' ? (
          <View
            style={[
              styles.card,
              {
                borderColor: colors.info.main + '55',
                backgroundColor: colors.info.main + '14',
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginTop: spacing.md,
              },
            ]}
          >
            <Text style={[typography.body2, { color: colors.text.primary }]}>
              {t(
                'rentals.nextStep.returnReminder',
                'Return by {{time}} at {{location}}. The business will confirm when the item is back.',
                {
                  time: formatRentalRequestLocalDateTime(booking.end_at),
                  location:
                    booking.rental_location_listing?.business_location?.name ?? '—',
                }
              )}
            </Text>
            {overtimeAmount > 0 ? (
              <Text
                style={[
                  typography.body2,
                  {
                    color: colors.warning.dark ?? colors.warning.main,
                    marginTop: spacing.xs,
                  },
                ]}
              >
                {t(
                  'rentals.nextStep.overtimePending',
                  'Overtime payment in progress: {{amount}}.',
                  {
                    amount: formatRentalMoney(
                      overtimeAmount,
                      pricing?.currency ?? booking.currency
                    ),
                  }
                )}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.card,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
            {t('rentals.status', 'Status')}
          </Text>
          {booking.status === 'cancelled' ? (
            <Text style={[typography.body2, { color: colors.error.main, marginTop: spacing.xs }]}>
              {t('rentals.cancelled', 'Booking cancelled')}
            </Text>
          ) : (
            timelineSteps.map((step, idx) => {
              const done = currentIdx >= idx;
              return (
                <View key={step} style={[styles.timelineRow, { marginTop: spacing.xs }]}>
                  <MaterialCommunityIcons
                    name={done ? 'check-circle' : 'circle-outline'}
                    size={18}
                    color={done ? colors.success.main : colors.text.disabled}
                  />
                  <Text
                    style={[
                      typography.body2,
                      {
                        marginLeft: spacing.sm,
                        color: done ? colors.text.primary : colors.text.disabled,
                        fontWeight: done && idx === currentIdx ? '700' : '400',
                      },
                    ]}
                  >
                    {t(
                      resolveBookingPhase(step, 'client').labelKey,
                      PHASE_DEFAULTS[resolveBookingPhase(step, 'client').labelKey] ?? step
                    )}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {paymentPending ? (
          <View
            style={[
              styles.card,
              {
                borderColor: colors.warning.main + '55',
                backgroundColor: colors.warning.main + '14',
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginTop: spacing.md,
              },
            ]}
          >
            <Text style={[typography.body2, { color: colors.text.primary }]}>
              {isStripePending
                ? t(
                    'client.rentals.waitingPaymentStripe',
                    'Complete card payment to confirm this reservation. Use Retry payment if you closed the payment sheet.'
                  )
                : t('client.rentals.waitingPayment', 'Waiting for payment…')}
            </Text>
            {booking.contract_expires_at ? (
              <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>
                {t('rentals.clientRequests.contractCompleteBy', 'Complete booking by {{date}}', {
                  date: formatRentalRequestLocalDateTime(booking.contract_expires_at),
                })}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.card,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
            {t('rentals.clientRequests.requestedPeriod', 'Requested period')}
          </Text>
          <Text style={[typography.body2, { color: colors.text.primary, marginTop: 4 }]}>
            {formatRentalRequestLocalDateTime(booking.start_at)} —{' '}
            {formatRentalRequestLocalDateTime(booking.end_at)}
          </Text>
          {windows.map((w, i) => (
            <Text
              key={`${w.start_at}-${i}`}
              style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]}
            >
              {`${i + 1}. ${formatRentalRequestLocalDateTime(w.start_at)} — ${formatRentalRequestLocalDateTime(w.end_at)}`}
            </Text>
          ))}
          <Text style={[typography.subtitle2, { color: colors.text.primary, marginTop: spacing.md }]}>
            {t('rentals.clientRequests.quotedTotal', 'Quoted total')}
          </Text>
          <Text style={[typography.h6, { color: colors.text.primary }]}>
            {formatRentalMoney(
              pricing?.total ?? booking.total_amount,
              pricing?.currency ?? booking.currency
            )}
          </Text>
          {depositAmount > 0 ? (
            <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.xs }]}>
              {t('rentals.bookingDetail.securityDeposit', 'Security deposit')}
              {': '}
              {formatRentalMoney(depositAmount, pricing?.currency ?? booking.currency)}
            </Text>
          ) : null}
          {authorizedAmount > 0 ? (
            <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.xs }]}>
              {t(
                'rentals.bookingDetail.authorizedOnCard',
                'Held on your card (rental + deposit): {{amount}}. The final charge at return is at least the rental total; the deposit only covers extra hours.',
                {
                  amount: formatRentalMoney(
                    authorizedAmount,
                    pricing?.currency ?? booking.currency
                  ),
                }
              )}
            </Text>
          ) : null}
          {isPayAtPickup && booking.payment_status !== 'paid' ? (
            <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.xs }]}>
              {t(
                'rentals.bookingDetail.payAtPickup',
                'Nothing paid yet — the rental total is due at pickup.'
              )}
            </Text>
          ) : null}
          {overtimeAmount > 0 ? (
            <Text style={[typography.body2, { color: colors.warning.dark ?? colors.warning.main, marginTop: spacing.xs }]}>
              {t('rentals.bookingDetail.overtimeDue', 'Extra hours: {{amount}}', {
                amount: formatRentalMoney(
                  overtimeAmount,
                  pricing?.currency ?? booking.currency
                ),
              })}
            </Text>
          ) : null}
          {canCancel ? (
            <Text style={[typography.caption, { color: colors.success.main, marginTop: spacing.xs }]}>
              {t(
                'rentals.clientRequests.freeCancelBeforeStart',
                'Free cancellation any time before the rental starts.'
              )}
            </Text>
          ) : null}
        </View>

        {isReserved ? (
          <View
            style={[
              styles.card,
              {
                borderColor: colors.info.main + '55',
                backgroundColor: colors.info.main + '14',
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginTop: spacing.md,
              },
            ]}
          >
            <Text style={[typography.body2, { color: colors.text.primary }]}>
              {t(
                'rentals.bookingDetail.reservedClientHint',
                'Your reservation is held for free. Pay the rental total at pickup to receive your start PIN.'
              )}
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {canCancel ? (
            <Button
              mode="outlined"
              textColor={colors.error.main}
              loading={actionLoading}
              onPress={() => setCancelOpen(true)}
            >
              {t('rentals.cancelBooking', 'Cancel booking')}
            </Button>
          ) : null}
        </View>

        {booking.status !== 'cancelled' ? (
          <View
            style={[
              styles.card,
              shadows.sm,
              {
                borderColor: colors.divider,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginTop: spacing.md,
              },
            ]}
          >
            <Text style={[typography.subtitle2, { color: colors.text.primary, marginBottom: spacing.sm }]}>
              {t('rentals.messages.title', 'Messages')}
            </Text>
            <OrderMessageComposer
              messages={messages}
              loading={messagesLoading}
              error={messagesError}
              mentionableParticipants={mentionableParticipants}
              onSend={async (message, mentionedUserId) => {
                const ok = await sendMessage(message, mentionedUserId);
                if (ok && messages[0]?.id) {
                  void markMessagesRead(messages[0].id);
                }
                return ok;
              }}
              formatDate={formatMessageDate}
              onRefresh={() => void refetchMessages()}
              emptyHint={t(
                'rentals.messages.emptyHint',
                'Message the other party about pickup, return, or the rental.'
              )}
            />
          </View>
        ) : null}
      </ScrollView>

      {canShowPin || paymentPending ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            gap: spacing.sm,
          }}
        >
          {paymentPending ? (
            <Button
              mode="contained"
              loading={actionLoading || sheetLoading}
              onPress={() => void onRetry()}
            >
              {t('rentals.actions.completePayment', 'Complete payment')}
            </Button>
          ) : (
            <SendRentalStartPinButton
              bookingId={booking.id}
              onSent={() => void refetchMessages()}
              onError={(msg) => setSnack(msg)}
            />
          )}
        </View>
      ) : null}

      <Portal>
        <Dialog visible={pinOpen} onDismiss={() => setPinOpen(false)}>
          <Dialog.Title>{t('rentals.yourPin', 'Your start PIN')}</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.h4, { color: colors.text.primary, textAlign: 'center' }]}>
              {pinValue ?? '—'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPinOpen(false)}>{t('common.close', 'Close')}</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={cancelOpen} onDismiss={() => setCancelOpen(false)}>
          <Dialog.Title>{t('rentals.cancelBooking', 'Cancel booking')}</Dialog.Title>
          <Dialog.Content>
            <Text>
              {t(
                'rentals.bookingDetail.cancelBeforeStartMessage',
                'This booking has not started, so cancellation is free. Any card hold or wallet hold is released.'
              )}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCancelOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button onPress={() => void onCancel()} textColor={colors.error.main}>
              {t('rentals.cancelBooking', 'Cancel booking')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3500}>
        {snack}
      </Snackbar>

      <ImageLightbox
        visible={lightboxOpen}
        images={bookingImages}
        index={lightboxIdx}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIdx}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { width: '100%', aspectRatio: 16 / 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  card: { borderWidth: 1 },
  timelineRow: { flexDirection: 'row', alignItems: 'center' },
});
