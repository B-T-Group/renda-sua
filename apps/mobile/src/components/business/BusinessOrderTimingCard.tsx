import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { Order } from '../../types/agent';
import {
  resolveBusinessOrderTiming,
  type BusinessOrderTiming,
} from '../../utils/businessOrderListDisplay';
import { formatPreferredDate, formatTimeSlotValue } from '../../utils/deliveryWindowUtils';

type Scheduled = Extract<BusinessOrderTiming, { kind: 'scheduled' }>;

export function BusinessOrderTimingCard({ order, locale }: { order: Order; locale: string }) {
  const timing = resolveBusinessOrderTiming(order);
  if (timing.kind === 'none') return null;
  if (timing.kind === 'asap') return <AsapTiming pickup={timing.pickup} />;
  return <ScheduledTiming pickup={timing.pickup} window={timing.window} locale={locale} />;
}

function AsapTiming({ pickup }: { pickup: boolean }) {
  const { t } = useTranslation();
  const body = pickup
    ? t('business.orders.timing.asapPickup', 'The customer will pick this up as soon as it is ready.')
    : t('business.orders.timing.asapDelivery', 'The customer wants this delivered as soon as possible.');
  return (
    <TimingShell icon="clock-fast" tone="now" title={t('business.orders.timing.fulfillNow', 'Fulfill now')}>
      <Body>{body}</Body>
    </TimingShell>
  );
}

function ScheduledTiming({
  pickup,
  window,
  locale,
}: {
  pickup: boolean;
  window: Scheduled['window'];
  locale: string;
}) {
  const { t } = useTranslation();
  const title = pickup
    ? t('business.orders.timing.pickupTitle', 'Pickup time the customer chose')
    : t('business.orders.timing.deliveryTitle', 'Delivery time the customer chose');
  return (
    <TimingShell icon="calendar-clock" tone="slot" title={title}>
      <SlotLines window={window} locale={locale} />
    </TimingShell>
  );
}

function SlotLines({ window, locale }: { window: Scheduled['window']; locale: string }) {
  const { colors, spacing } = useTheme();
  const range =
    window.time_slot_start && window.time_slot_end
      ? `${formatTimeSlotValue(window.time_slot_start, locale)} – ${formatTimeSlotValue(window.time_slot_end, locale)}`
      : '';
  const when = [range, window.slot?.slot_name?.trim()].filter(Boolean).join(' · ');
  return (
    <View>
      <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text.primary, marginTop: 2 }}>
        {window.preferred_date ? formatPreferredDate(window.preferred_date, locale) : '—'}
      </Text>
      {when ? <Text variant="bodyLarge" style={{ color: colors.text.primary, marginTop: 2 }}>{when}</Text> : null}
      {window.special_instructions ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xs }}>
          {window.special_instructions}
        </Text>
      ) : null}
    </View>
  );
}

function Body({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: 2 }}>
      {children}
    </Text>
  );
}

function TimingShell({
  icon,
  tone,
  title,
  children,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: 'now' | 'slot';
  title: string;
  children: ReactNode;
}) {
  const { colors, spacing, borderRadius } = useTheme();
  const now = tone === 'now';
  return (
    <View
      accessibilityRole="summary"
      style={{
        marginBottom: spacing.xs,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: now ? colors.warningTint : colors.surface,
        borderWidth: now ? 0 : 1,
        borderColor: colors.primary.main,
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'flex-start',
      }}
    >
      <MaterialCommunityIcons
        name={icon}
        size={28}
        color={now ? colors.warning.main : colors.primary.main}
      />
      <View style={{ flex: 1 }}>
        <Text variant={now ? 'titleMedium' : 'labelMedium'} style={{ fontWeight: now ? '700' : '600', color: now ? colors.text.primary : colors.text.secondary }}>
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}
