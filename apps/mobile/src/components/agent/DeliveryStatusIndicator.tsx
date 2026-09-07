import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

export type StatusTone = 'success' | 'active' | 'attention' | 'secondary';

export interface DeliveryStatusIndicatorProps {
  label: string;
  tone?: StatusTone;
  compact?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

function toneToColors(
  tone: StatusTone,
  colors: ReturnType<typeof useTheme>['colors']
): { bg: string; fg: string } {
  switch (tone) {
    case 'success':
      return { bg: colors.success.main + '1A', fg: colors.success.dark };
    case 'active':
      return { bg: colors.primary.main + '1A', fg: colors.primary.dark };
    case 'attention':
      return { bg: colors.warning.main + '1A', fg: colors.warning.dark };
    case 'secondary':
    default:
      return { bg: colors.text.disabled + '22', fg: colors.text.secondary };
  }
}

function toneToIcon(tone: StatusTone): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (tone) {
    case 'success':
      return 'check-circle';
    case 'active':
      return 'truck-delivery';
    case 'attention':
      return 'alert-circle';
    case 'secondary':
    default:
      return 'circle-outline';
  }
}

/** Consistent, glanceable status chip for delivery orders. */
export function DeliveryStatusIndicator({
  label,
  tone = 'secondary',
  compact = false,
  icon,
}: DeliveryStatusIndicatorProps) {
  const { colors } = useTheme();
  const { bg, fg } = toneToColors(tone, colors);
  const iconName = icon ?? toneToIcon(tone);
  const iconSize = compact ? 12 : 14;
  const fontSize = compact ? 11 : 12;

  return (
    <View
      style={[
        styles.pill,
        compact ? styles.compact : styles.regular,
        { backgroundColor: bg },
      ]}
    >
      <MaterialCommunityIcons name={iconName} size={iconSize} color={fg} />
      <Text
        style={[
          styles.label,
          {
            color: fg,
            fontSize,
            lineHeight: iconSize + 2,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/** Maps a raw order status string to a StatusTone. */
export function statusToTone(status: string): StatusTone {
  switch (status) {
    case 'delivered':
    case 'complete':
      return 'success';
    case 'assigned_to_agent':
    case 'picked_up':
    case 'in_transit':
    case 'out_for_delivery':
    case 'ready_for_pickup':
      return 'active';
    case 'pending':
    case 'pending_payment':
    case 'confirmed':
    case 'preparing':
      return 'attention';
    case 'cancelled':
    case 'failed':
    case 'refunded':
    default:
      return 'secondary';
  }
}

/** Human-readable label for a delivery status. */
export function statusToLabel(
  status: string,
  t: (key: string, fallback: string) => string
): string {
  const fallback = status.replace(/_/g, ' ');
  return t(`common.orderStatus.${status}`, fallback);
}

/** Returns the primary action label for a given status. */
export function statusToPrimaryAction(
  status: string,
  t: (key: string, fallback: string) => string
): string | null {
  switch (status) {
    case 'assigned_to_agent':
      return t('agent.orders.detail.pickUp', 'Pick up order');
    case 'picked_up':
      return t('agent.orders.detail.outForDelivery', 'Out for delivery');
    case 'in_transit':
      return t('agent.orders.detail.outForDelivery', 'Out for delivery');
    case 'out_for_delivery':
      return t('orderActions.completeDelivery', 'Complete delivery');
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    gap: 4,
  },
  regular: { paddingHorizontal: 10, paddingVertical: 4 },
  compact: { paddingHorizontal: 8, paddingVertical: 3 },
  label: { fontWeight: '600', includeFontPadding: false },
});
