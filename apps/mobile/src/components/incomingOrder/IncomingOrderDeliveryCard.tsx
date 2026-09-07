import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { IncomingOrderDetails } from '../../types/incomingOrder';
import {
  formatPreferredDate,
  formatTimeSlotValue,
} from '../../utils/deliveryWindowUtils';
import { StatusPill } from '../common/StatusPill';

interface Props {
  details: IncomingOrderDetails;
  isSlotPast: boolean;
}

function QuietCard({
  children,
  isSlotPast,
}: {
  children: React.ReactNode;
  isSlotPast?: boolean;
}) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isSlotPast ? colors.errorTint : colors.surface,
          borderColor: isSlotPast ? colors.error.light : colors.border,
          borderRadius: borderRadius.md,
          padding: spacing.sm,
          marginTop: spacing.md,
        },
      ]}
    >
      {children}
    </View>
  );
}

function LabelRow({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={colors.text.secondary}
      />
      <Text
        variant="labelMedium"
        style={{ color: colors.text.secondary, marginLeft: spacing.xs }}
      >
        {label}
      </Text>
    </View>
  );
}

function ShippingCard() {
  const { t } = useTranslation();
  return (
    <QuietCard>
      <LabelRow
        icon="package-variant-closed"
        label={t('incomingOrder.shippingOrder', 'Carrier shipping')}
      />
    </QuietCard>
  );
}

function AsapCard({ details }: { details: IncomingOrderDetails }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const label =
    details.fulfillment_method === 'pickup'
      ? t('incomingOrder.asapPickup', 'ASAP pickup')
      : t('incomingOrder.asapDelivery', 'ASAP delivery');
  const byTime = details.promised_fulfill_by
    ? new Date(details.promised_fulfill_by).toLocaleTimeString(i18n.language, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;
  return (
    <QuietCard>
      <LabelRow icon="lightning-bolt" label={label} />
      {byTime ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: 2 }}
        >
          {t('incomingOrder.asapBy', 'By {{time}}', { time: byTime })}
        </Text>
      ) : null}
    </QuietCard>
  );
}

function SlotPassedNotice() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
      <StatusPill
        compact
        icon="clock-alert-outline"
        label={t('incomingOrder.slotPassedBadge', 'Slot passed')}
        backgroundColor={colors.error.main + '22'}
        textColor={colors.error.dark}
      />
      <Text variant="bodySmall" style={{ color: colors.error.dark }}>
        {t(
          'incomingOrder.slotPassed',
          'This delivery window has already passed.'
        )}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t(
          'incomingOrder.slotPassedHint',
          'You can no longer confirm this order. Please cancel it so the customer is not left waiting.'
        )}
      </Text>
    </View>
  );
}

function ScheduledCard({
  details,
  isSlotPast,
}: {
  details: IncomingOrderDetails;
  isSlotPast: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const window = details.delivery_time_windows![0];
  const dateLabel = window.preferred_date
    ? formatPreferredDate(window.preferred_date, i18n.language)
    : '';
  const startLabel = formatTimeSlotValue(window.time_slot_start, i18n.language);
  const endLabel = formatTimeSlotValue(window.time_slot_end, i18n.language);
  const timeRange =
    startLabel && endLabel ? `${startLabel} – ${endLabel}` : startLabel || endLabel;
  return (
    <QuietCard isSlotPast={isSlotPast}>
      <LabelRow
        icon="calendar-clock"
        label={t('incomingOrder.scheduledDelivery', 'Scheduled delivery')}
      />
      {dateLabel ? (
        <Text
          variant="bodyMedium"
          style={{ color: colors.text.primary, marginTop: 2, fontWeight: '600' }}
        >
          {dateLabel}
          {timeRange ? `  ·  ${timeRange}` : ''}
        </Text>
      ) : null}
      {window.slot?.slot_name ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: 2 }}
        >
          {window.slot.slot_name}
        </Text>
      ) : null}
      {isSlotPast ? <SlotPassedNotice /> : null}
      {window.special_instructions ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: 2 }}
        >
          {window.special_instructions}
        </Text>
      ) : null}
    </QuietCard>
  );
}

export function IncomingOrderDeliveryCard({ details, isSlotPast }: Props) {
  const window = details.delivery_time_windows?.[0];
  const isScheduled = Boolean(window?.preferred_date);
  if (!isScheduled && details.fulfillment_method === 'shipping') {
    return <ShippingCard />;
  }
  if (!isScheduled) return <AsapCard details={details} />;
  return <ScheduledCard details={details} isSlotPast={isSlotPast} />;
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
});
