import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import type { AgentOrderMoreItemId } from '../../utils/agentOrderDetailMoreItems';

type Props = {
  visible: boolean;
  items: AgentOrderMoreItemId[];
  onClose: () => void;
  onSelect: (id: AgentOrderMoreItemId) => void;
};

const ITEM_COPY: Record<
  AgentOrderMoreItemId,
  { key: string; fallback: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; danger?: boolean }
> = {
  runningLate: {
    key: 'agentOrder.more.runningLate',
    fallback: "I'm running late",
    icon: 'clock-alert-outline',
  },
  release: {
    key: 'agentOrder.more.release',
    fallback: 'Release order',
    icon: 'exit-run',
    danger: true,
  },
  reportIssue: {
    key: 'agentOrder.more.reportIssue',
    fallback: 'Report a problem',
    icon: 'alert-circle-outline',
  },
  failDelivery: {
    key: 'agent.orders.detail.deliveryFailed',
    fallback: 'Delivery failed',
    icon: 'close-circle',
    danger: true,
  },
  markPaidCash: {
    key: 'agent.orders.payAtDelivery.markPaidInCash',
    fallback: 'Mark paid in cash',
    icon: 'cash-multiple',
  },
};

export function AgentOrderDetailMoreSheet({ visible, items, onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close', 'Close')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.7,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {items.map((id) => {
            const copy = ITEM_COPY[id];
            const color = copy.danger ? colors.error.main : colors.text.primary;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  onClose();
                  onSelect(id);
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t(copy.key, copy.fallback)}
              >
                <MaterialCommunityIcons name={copy.icon} size={22} color={color} />
                <Text variant="bodyLarge" style={[styles.label, { color }]}>
                  {t(copy.key, copy.fallback)}
                </Text>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    overflow: 'hidden',
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
  },
});
