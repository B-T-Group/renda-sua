import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import type { CookedFoodStoreClosedDetails } from '@/types/checkout';

export interface KitchenClosedStickyPanelProps {
  details?: CookedFoodStoreClosedDetails | null;
  /** Fallback when structured details are missing. */
  message?: string | null;
  /** Compact fulfillment control kept above the closed panel. */
  topContent?: ReactNode;
}

function formatNextOpening(
  nextOpensAt: string | null | undefined,
  timezone: string,
  locale: string
): string | null {
  if (!nextOpensAt) return null;
  try {
    const date = new Date(nextOpensAt);
    if (Number.isNaN(date.getTime())) return null;
    const weekday = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      timeZone: timezone,
    }).format(date);
    const time = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(date);
    return `${weekday} · ${time}`;
  } catch {
    return null;
  }
}

function weekdayLabel(dayOfWeek: number, locale: string): string {
  try {
    const sunday = new Date(Date.UTC(2024, 0, 7)); // Sunday
    const day = new Date(sunday);
    day.setUTCDate(sunday.getUTCDate() + dayOfWeek);
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day);
  } catch {
    return String(dayOfWeek);
  }
}

/**
 * Sticky bottom panel shown when cooked-food ASAP checkout is blocked because
 * the kitchen is closed. Replaces CheckoutStickyActionBar (no Place Order CTA).
 */
export function KitchenClosedStickyPanel({
  details,
  message,
  topContent,
}: KitchenClosedStickyPanelProps) {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const locale = i18n.language || 'en';
  const timezone = details?.timezone || 'UTC';
  const nextOpening = formatNextOpening(details?.next_opens_at, timezone, locale);
  const hours = details?.hours ?? [];

  return (
    <View
      style={[
        styles.wrapper,
        shadows.large,
        {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.card,
          borderTopRightRadius: borderRadius.card,
          paddingTop: spacing.sm,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.md),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.divider,
        },
      ]}
    >
      {topContent ? <View>{topContent}</View> : null}

      <View style={{ gap: spacing.xs }}>
        <Text
          style={[
            typography.subheading,
            { color: colors.text.primary, fontWeight: '700' },
          ]}
        >
          {t('client.placeOrder.kitchenClosed.title', 'Kitchen closed')}
        </Text>

        {nextOpening ? (
          <View style={{ gap: 2 }}>
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {t('client.placeOrder.kitchenClosed.nextOpening', 'Next opening')}
            </Text>
            <Text
              style={[
                typography.subtitle1,
                { color: colors.text.primary, fontWeight: '700' },
              ]}
            >
              {nextOpening}
            </Text>
          </View>
        ) : null}

        {hours.length > 0 ? (
          <View style={{ gap: 4, marginTop: spacing.xs }}>
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {t('client.placeOrder.kitchenClosed.availableHours', 'Available hours')}
            </Text>
            {hours.map((slot) => (
              <View
                key={`${slot.day_of_week}-${slot.start_time}-${slot.end_time}`}
                style={styles.hourRow}
              >
                <Text
                  style={[typography.caption, { color: colors.text.primary, flex: 1 }]}
                >
                  {weekdayLabel(slot.day_of_week, locale)}
                </Text>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.text.primary, fontWeight: '600' },
                  ]}
                >
                  {slot.start_time}–{slot.end_time}
                </Text>
              </View>
            ))}
          </View>
        ) : message ? (
          <Text style={[typography.caption, { color: colors.text.secondary }]}>
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
