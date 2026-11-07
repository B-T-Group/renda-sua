import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
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

const CARD_MIN_WIDTH = 124;

function slotValue(slot: DedicatedCoveredSlot): string {
  return `${slot.date}|${slot.slot_id}`;
}

function formatDay(ymd: string, locale: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

function slotPeriodLabel(
  slot: DedicatedCoveredSlot,
  t: ReturnType<typeof useTranslation>['t']
): string {
  if (!slot.slot_key) return '';
  return t(
    `client.placeOrder.deliveryWindow.slotKey.${slot.slot_key}`,
    SLOT_KEY_LABELS[slot.slot_key] ?? slot.slot_key
  );
}

/**
 * #594: ASAP delivery is out (no nearby agent) but a dedicated agent covers
 * these scheduled slots, so only they are offered.
 */
export function CoveredDeliverySlotPicker({ slots, value, onChange }: CoveredDeliverySlotPickerProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();

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
  // Runs after every render (no deps): a parent can clear `value` in its own
  // effect right after this one committed the default (child effects run
  // first), leaving `value` null both before and after, so a deps-based effect
  // would never fire again and the order would go out with no window.
  useEffect(() => {
    if (isCoveredDeliveryWindow(value, slots)) return;
    const first = slots[0];
    if (!first && value == null) return;
    onChange(first ? { slot_id: first.slot_id, preferred_date: first.date } : null);
  });

  return (
    <View>
      {byDate.map(([date, dateSlots]) => (
        <View key={date} style={{ marginTop: spacing.sm }}>
          <Text
            variant="labelSmall"
            style={{
              color: colors.text.secondary,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: spacing.xs,
            }}
          >
            {formatDay(date, i18n.language)}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}
          >
            {dateSlots.map((slot) => {
              const selected =
                value?.slot_id === slot.slot_id && value?.preferred_date === slot.date;
              const name = slotPeriodLabel(slot, t);
              const range = `${slot.start}–${slot.end}`;
              const label = [name, range].filter(Boolean).join(' · ');
              return (
                <Pressable
                  key={slotValue(slot)}
                  testID={`covered-slot-${slot.date}-${slot.slot_id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                  onPress={() =>
                    onChange({ slot_id: slot.slot_id, preferred_date: slot.date })
                  }
                  style={[
                    styles.card,
                    {
                      minWidth: CARD_MIN_WIDTH,
                      borderRadius: borderRadius.md,
                      borderColor: selected ? colors.primary.main : colors.divider,
                      backgroundColor: selected
                        ? `${colors.primary.main}12`
                        : colors.surface,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                    },
                  ]}
                >
                  {name ? (
                    <Text
                      style={[
                        typography.subtitle2,
                        {
                          color: selected ? colors.primary.dark : colors.text.primary,
                          fontWeight: '700',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: selected ? colors.primary.main : colors.text.secondary,
                        fontWeight: '600',
                        marginTop: name ? 2 : 0,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {range}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    minHeight: 64,
    justifyContent: 'center',
  },
});
