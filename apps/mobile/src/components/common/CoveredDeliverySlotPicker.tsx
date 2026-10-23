import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RadioButton, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { DedicatedCoveredSlot } from '../../types/checkout';
import type { ClientDeliveryWindowPayload } from '../../types/deliveryWindow';
import { isCoveredDeliveryWindow } from '../../utils/checkoutPresentation';

export interface CoveredDeliverySlotPickerProps {
  /** Covered (date, slot) pairs from the preflight; cart-level for multi-seller carts. */
  slots: DedicatedCoveredSlot[];
  value: ClientDeliveryWindowPayload | null;
  onChange: (window: ClientDeliveryWindowPayload | null) => void;
}

const SLOT_KEY_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

function slotValue(slot: DedicatedCoveredSlot): string {
  return `${slot.date}|${slot.slot_id}`;
}

function formatDay(ymd: string, locale: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * #594: ASAP delivery is out (no nearby agent) but a dedicated agent covers
 * these scheduled slots, so only they are offered.
 */
export function CoveredDeliverySlotPicker({ slots, value, onChange }: CoveredDeliverySlotPickerProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();

  const byDate = useMemo(() => {
    const map = new Map<string, DedicatedCoveredSlot[]>();
    for (const slot of slots) {
      const list = map.get(slot.date) ?? [];
      list.push(slot);
      map.set(slot.date, list);
    }
    return [...map.entries()];
  }, [slots]);

  // Keep the selection inside the covered set; default to the earliest covered slot.
  useEffect(() => {
    if (isCoveredDeliveryWindow(value, slots)) return;
    const first = slots[0];
    onChange(first ? { slot_id: first.slot_id, preferred_date: first.date } : null);
  }, [slots, value, onChange]);

  const selected = value ? `${value.preferred_date}|${value.slot_id}` : '';

  return (
    <RadioButton.Group
      value={selected}
      onValueChange={(next) => {
        const slot = slots.find((s) => slotValue(s) === next);
        if (slot) onChange({ slot_id: slot.slot_id, preferred_date: slot.date });
      }}
    >
      {byDate.map(([date, dateSlots]) => (
        <View key={date} style={{ marginTop: spacing.sm }}>
          <Text
            variant="labelSmall"
            style={{ color: colors.text.secondary, letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            {formatDay(date, i18n.language)}
          </Text>
          {dateSlots.map((slot) => {
            const name = slot.slot_key
              ? t(
                  `client.placeOrder.deliveryWindow.slotKey.${slot.slot_key}`,
                  SLOT_KEY_LABELS[slot.slot_key] ?? slot.slot_key
                )
              : '';
            const pickup = slot.pickup_time
              ? t('client.placeOrder.deliveryWindow.dedicatedPickupAt', {
                  time: slot.pickup_time,
                  defaultValue: `Picked up from the store at ${slot.pickup_time}`,
                })
              : '';
            const label = [name, `${slot.start}–${slot.end}`].filter(Boolean).join(' · ');
            return (
              <View key={slotValue(slot)} testID={`covered-slot-${slot.date}-${slot.slot_id}`}>
                <RadioButton.Item
                  value={slotValue(slot)}
                  label={pickup ? `${label}\n${pickup}` : label}
                  mode="android"
                  position="leading"
                  labelVariant="bodyMedium"
                  accessibilityLabel={pickup ? `${label}, ${pickup}` : label}
                />
              </View>
            );
          })}
        </View>
      ))}
    </RadioButton.Group>
  );
}
