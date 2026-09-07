import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, RadioButton, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { usePlaceOrderDeliveryWindow } from '../../hooks/usePlaceOrderDeliveryWindow';
import type { ClientDeliveryWindowPayload, DeliveryTimeSlot } from '../../types/deliveryWindow';
import { formatSlotTimeRange } from '../../utils/deliveryWindowUtils';

function dayParts(ymd: string, locale: string): { weekday: string; dayMonth: string } {
  const d = new Date(`${ymd}T12:00:00`);
  return {
    weekday: d.toLocaleDateString(locale, { weekday: 'short' }),
    dayMonth: d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
  };
}

function DayPill({
  ymd,
  selected,
  onPress,
}: {
  ymd: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { weekday, dayMonth } = dayParts(ymd, i18n.language);
  const accLabel = `${weekday} ${dayMonth}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dayPill,
        {
          borderRadius: borderRadius.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          minWidth: 76,
          alignItems: 'center',
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          borderColor: selected ? colors.primary.light : colors.border,
          backgroundColor: selected ? `${colors.primary.main}14` : colors.surface,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text
        variant="labelSmall"
        style={{
          color: selected ? colors.primary.main : colors.text.secondary,
          fontWeight: '600',
        }}
      >
        {weekday}
      </Text>
      <Text
        variant="titleSmall"
        style={{
          marginTop: 2,
          color: selected ? colors.primary.dark : colors.text.primary,
          fontWeight: '700',
        }}
      >
        {dayMonth}
      </Text>
      {selected ? (
        <View style={[styles.selectedDot, { backgroundColor: colors.primary.main, marginTop: spacing.xxs }]} />
      ) : (
        <View style={{ height: spacing.xxs + 4 }} />
      )}
    </Pressable>
  );
}

function SlotRow({
  slot,
  selected,
  bookable,
  label,
}: {
  slot: DeliveryTimeSlot;
  selected: boolean;
  bookable: boolean;
  label: string;
}) {
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <RadioButton.Item
      value={slot.id}
      label={label}
      disabled={!bookable}
      position="leading"
      labelVariant="bodyMedium"
      color={colors.primary.main}
      uncheckedColor={colors.text.disabled}
      labelStyle={{
        color: bookable ? colors.text.primary : colors.text.disabled,
        fontWeight: selected && bookable ? '600' : '400',
      }}
      style={[
        styles.slotRow,
        {
          marginBottom: spacing.xs,
          borderRadius: borderRadius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: selected && bookable ? colors.primary.light : colors.border,
          backgroundColor:
            selected && bookable ? `${colors.primary.main}10` : colors.surface,
        },
      ]}
    />
  );
}

export interface DeliveryWindowPickerProps {
  countryCode: string;
  stateCode: string;
  enabled: boolean;
  isFastDelivery?: boolean;
  /** When pickup, date/slot labels use pickup wording instead of delivery. */
  fulfillment?: 'delivery' | 'pickup';
  /** When provided, only slots fully contained within this location's operating hours are shown. */
  businessLocationId?: string;
  onSelectionChange: (value: ClientDeliveryWindowPayload | null) => void;
  onReadyChange?: (ready: boolean) => void;
}

export function DeliveryWindowPicker({
  countryCode,
  stateCode,
  enabled,
  isFastDelivery,
  fulfillment = 'delivery',
  businessLocationId,
  onSelectionChange,
  onReadyChange,
}: DeliveryWindowPickerProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const isPickup = fulfillment === 'pickup';
  const dw = usePlaceOrderDeliveryWindow({
    countryCode,
    stateCode,
    enabled,
    isFastDelivery,
    businessLocationId,
  });

  useEffect(() => {
    onReadyChange?.(dw.canProceedWithOrder);
  }, [dw.canProceedWithOrder, onReadyChange]);

  useEffect(() => {
    if (!enabled) {
      onSelectionChange(null);
      return;
    }
    if (dw.canProceedWithOrder && dw.preferredDate && dw.slotId) {
      onSelectionChange({ slot_id: dw.slotId, preferred_date: dw.preferredDate });
    } else {
      onSelectionChange(null);
    }
  }, [dw.canProceedWithOrder, dw.preferredDate, dw.slotId, enabled, onSelectionChange]);

  if (!enabled) return null;

  // Always keep the day strip visible once we have calendar options — even when
  // the selected day has zero slots. Hiding it made pickup look like there was
  // no date/time UI at all ("No slots for this date" with nothing to tap).
  const showDayStrip = !dw.loading && !dw.error && dw.dayOptions.length > 0;
  const showSlotList = showDayStrip && dw.slots.length > 0;
  const showEmptySlots =
    !dw.loading && !dw.error && showDayStrip && dw.slots.length === 0;

  return (
    <View>
      {dw.loading ? (
        <View style={[styles.rowCenter, { marginTop: spacing.sm }]}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Text variant="bodySmall" style={{ marginLeft: spacing.sm, color: colors.text.secondary }}>
            {t('client.placeOrder.deliveryWindow.loadingSlots', 'Loading time slots…')}
          </Text>
        </View>
      ) : null}

      {dw.error ? (
        <View style={{ marginTop: spacing.sm }}>
          <Text variant="bodySmall" style={{ color: colors.error.main }}>
            {dw.error}
          </Text>
          <Button mode="text" compact onPress={() => dw.reload()} style={{ alignSelf: 'flex-start' }}>
            {t('common.retry', 'Retry')}
          </Button>
        </View>
      ) : null}

      {showDayStrip ? (
        <View style={{ marginTop: spacing.md }}>
          <Text
            variant="labelSmall"
            style={{
              color: colors.text.secondary,
              marginBottom: spacing.sm,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {isPickup
              ? t('client.placeOrder.deliveryWindow.pickupDate', 'Pickup date')
              : t('client.placeOrder.deliveryWindow.preferredDate', 'Preferred delivery date')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: spacing.xs,
              paddingBottom: spacing.xs,
              paddingRight: spacing.md,
            }}
          >
            {dw.dayOptions.map((ymd) => (
              <DayPill
                key={ymd}
                ymd={ymd}
                selected={dw.preferredDate === ymd}
                onPress={() => dw.setPreferredDate(ymd)}
              />
            ))}
          </ScrollView>
          {dw.dayOptions.length > 6 ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xs }}>
              {t('client.placeOrder.deliveryWindow.scrollDaysHint', 'Swipe sideways for more dates.')}
            </Text>
          ) : null}

          <View style={[styles.sectionRule, { backgroundColor: colors.divider, marginVertical: spacing.md }]} />

          {showEmptySlots ? (
            <Text
              variant="bodyMedium"
              style={{ color: colors.text.secondary, lineHeight: 22 }}
            >
              {isPickup
                ? t(
                    'client.placeOrder.deliveryWindow.noPickupSlotsForDate',
                    'No pickup slots available for this date. Try another day.'
                  )
                : t(
                    'client.placeOrder.deliveryWindow.noSlotsForDate',
                    'No delivery slots available for this date. Try another day.'
                  )}
            </Text>
          ) : null}

          {showSlotList ? (
            <>
              <Text
                variant="labelSmall"
                style={{
                  color: colors.text.secondary,
                  marginBottom: spacing.sm,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                {t('client.placeOrder.deliveryWindow.pickSlot', 'Select a time slot')}
              </Text>
              <RadioButton.Group value={dw.slotId ?? ''} onValueChange={dw.setSlotId}>
                {dw.slots.map((slot) => {
                  const range = formatSlotTimeRange(slot);
                  const bookable = slot.is_available && slot.available_capacity > 0;
                  const label = [
                    slot.slot_name,
                    range,
                    ...(bookable
                      ? []
                      : [t('client.placeOrder.deliveryWindow.unavailable', 'Unavailable')]),
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      selected={dw.slotId === slot.id}
                      bookable={bookable}
                      label={label}
                    />
                  );
                })}
              </RadioButton.Group>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayPill: {
    justifyContent: 'center',
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  slotRow: {
    paddingVertical: 2,
  },
});
