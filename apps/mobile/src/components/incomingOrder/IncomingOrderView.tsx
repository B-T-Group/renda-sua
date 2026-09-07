import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme';
import type { IncomingOrderDetails } from '../../types/incomingOrder';
import type { IncomingOrderUiState } from '../../stores/IncomingOrderStore';
import { OrderJourneyReceivedVector } from '../illustrations/OrderJourneyIllustrations';
import { IncomingOrderDeliveryCard } from './IncomingOrderDeliveryCard';
import { IncomingOrderItemsList } from './IncomingOrderItemsList';
import { IncomingOrderActions } from './IncomingOrderActions';

interface Props {
  uiState: IncomingOrderUiState;
  details: IncomingOrderDetails | null;
  message: string | null;
  secondsLeft: number | null;
  isSlotPast: boolean;
  showFirstOrderGuidance?: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  onBusy: () => void;
  onDecline: () => void;
}

function timerTone(secondsLeft: number, colors: ThemeColors) {
  if (secondsLeft < 30) {
    return { bg: `${colors.error.main}22`, fg: colors.error.main };
  }
  if (secondsLeft < 90) {
    const fg = colors.warning.main;
    return { bg: `${fg}22`, fg };
  }
  return { bg: `${colors.error.main}22`, fg: colors.error.main };
}

function countdownLabel(
  secondsLeft: number,
  t: ReturnType<typeof useTranslation>['t']
): string {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  if (mins > 0) {
    return t('incomingOrder.timeLeft', '{{m}}m {{s}}s to accept', {
      m: mins,
      s: secs,
    });
  }
  return t('incomingOrder.secondsLeft', '{{seconds}}s to accept', {
    seconds: secondsLeft,
  });
}

function TimerPill({ secondsLeft }: { secondsLeft: number }) {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const { bg, fg } = timerTone(secondsLeft, colors);
  return (
    <View
      style={[
        styles.timer,
        { backgroundColor: bg, borderRadius: borderRadius.lg, padding: spacing.sm },
      ]}
    >
      <MaterialCommunityIcons
        name="timer-outline"
        size={20}
        color={fg}
        style={{ marginRight: spacing.xs }}
      />
      <Text variant="titleMedium" style={{ color: fg, fontWeight: '700' }}>
        {countdownLabel(secondsLeft, t)}
      </Text>
    </View>
  );
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function AmountBadge({ amount, currency }: { amount: number; currency: string }) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View
      style={[
        styles.amountPill,
        {
          backgroundColor: colors.primaryTint,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          marginRight: spacing.xs,
        },
      ]}
    >
      <Text
        variant="titleMedium"
        style={{ color: colors.primary.main, fontWeight: '700' }}
      >
        {formatAmount(amount, currency)}
      </Text>
    </View>
  );
}

function clientName(details: IncomingOrderDetails | null): string {
  return [details?.client?.user?.first_name, details?.client?.user?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function extraPrepMinutesOf(details: IncomingOrderDetails | null): number | null {
  const extra = details?.busy_extra_prep_minutes ?? 0;
  return extra > 0 ? extra : null;
}

function IncomingOrderHeader({
  details,
  isDismissLocked,
  showFirstOrderGuidance,
  onDismiss,
}: {
  details: IncomingOrderDetails | null;
  isDismissLocked: boolean;
  showFirstOrderGuidance?: boolean;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const name = clientName(details);
  return (
    <View style={styles.headerRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          variant="headlineMedium"
          style={{ color: colors.text.primary, fontWeight: '700' }}
        >
          {showFirstOrderGuidance
            ? t('incomingOrder.firstOrderTitle', 'Your first order!')
            : t('incomingOrder.title', 'New order')}
        </Text>
        {details?.order_number ? (
          <Text
            variant="titleMedium"
            style={{ color: colors.primary.main, marginTop: 2 }}
          >
            {t('incomingOrder.orderNumber', 'Order {{number}}', {
              number: details.order_number,
            })}
          </Text>
        ) : (
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {t('incomingOrder.loading', 'Loading…')}
          </Text>
        )}
        {name ? (
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.secondary, marginTop: 2 }}
          >
            {name}
          </Text>
        ) : null}
      </View>
      {details?.total_amount != null ? (
        <AmountBadge
          amount={details.total_amount}
          currency={details.currency ?? 'XAF'}
        />
      ) : null}
      <IconButton
        icon="close"
        size={22}
        onPress={onDismiss}
        disabled={isDismissLocked}
        accessibilityLabel={t('incomingOrder.dismiss', 'Review later')}
        style={styles.closeBtn}
      />
    </View>
  );
}

function resolvedCopy(
  status: string,
  t: ReturnType<typeof useTranslation>['t']
): string {
  if (status === 'cancelled' || status === 'auto_cancelled') {
    return t(
      'incomingOrder.alreadyCancelled',
      'This order was already cancelled.'
    );
  }
  if (status === 'pending') {
    return t(
      'incomingOrder.noLongerPending',
      'This order is no longer waiting for confirmation.'
    );
  }
  return t(
    'incomingOrder.alreadyConfirmed',
    'This order was already confirmed.'
  );
}

function IncomingOrderResolvedBlock({
  status,
  onDismiss,
}: {
  status: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        variant="bodyLarge"
        style={{
          color: colors.text.primary,
          textAlign: 'center',
          marginBottom: spacing.xs,
        }}
      >
        {resolvedCopy(status, t)}
      </Text>
      <Button mode="contained" onPress={onDismiss} icon="close">
        {t('incomingOrder.close', 'Close')}
      </Button>
    </View>
  );
}

export function IncomingOrderView({
  uiState,
  details,
  message,
  secondsLeft,
  isSlotPast,
  showFirstOrderGuidance = false,
  onDismiss,
  onConfirm,
  onBusy,
  onDecline,
}: Props) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isResolved = uiState === 'resolved';
  const isDisabled =
    uiState === 'loading' ||
    uiState === 'busy' ||
    uiState === 'confirming' ||
    isResolved;
  const isDismissLocked = uiState === 'confirming' || (isSlotPast && !isResolved);
  const showIllustration = Boolean(details) && !isSlotPast && !isResolved;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.pageBackground,
        },
      ]}
    >
      <IncomingOrderHeader
        details={details}
        isDismissLocked={isDismissLocked}
        showFirstOrderGuidance={showFirstOrderGuidance}
        onDismiss={onDismiss}
      />
      {showIllustration ? (
        <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
          <OrderJourneyReceivedVector size={72} />
        </View>
      ) : null}
      {!isSlotPast && secondsLeft != null && secondsLeft > 0 ? (
        <TimerPill secondsLeft={secondsLeft} />
      ) : null}
      {details ? (
        <IncomingOrderDeliveryCard details={details} isSlotPast={isSlotPast} />
      ) : null}
      <ScrollView
        style={{ flex: 1, marginTop: spacing.md }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.sm }}
      >
        {details?.order_items?.length ? (
          <IncomingOrderItemsList items={details.order_items} />
        ) : null}
      </ScrollView>
      {message ? (
        <Text
          variant="bodySmall"
          style={{
            color: colors.text.secondary,
            textAlign: 'center',
            marginBottom: spacing.sm,
          }}
        >
          {message}
        </Text>
      ) : null}
      {isResolved ? (
        <IncomingOrderResolvedBlock
          status={details?.current_status ?? ''}
          onDismiss={onDismiss}
        />
      ) : (
        <>
          {showFirstOrderGuidance ? (
            <Text
              variant="bodyMedium"
              style={{
                color: colors.text.secondary,
                textAlign: 'center',
                marginBottom: spacing.sm,
              }}
            >
              {t(
                'incomingOrder.firstOrderStrip',
                'Review the items, then confirm. We will guide you through packing and delivery step by step.'
              )}
            </Text>
          ) : null}
          <IncomingOrderActions
          isDisabled={isDisabled}
          isDismissLocked={isDismissLocked}
          isConfirming={uiState === 'confirming'}
          isSlotPast={isSlotPast}
          extraPrepMinutes={extraPrepMinutesOf(details)}
          fulfillmentMethod={details?.fulfillment_method}
          onConfirm={onConfirm}
          onBusy={onBusy}
          onDismiss={onDismiss}
          onDecline={onDecline}
        />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  amountPill: { alignSelf: 'flex-start', alignItems: 'center' },
  closeBtn: { margin: 0 },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
