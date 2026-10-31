import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { formatAgentOrderUrgencyDisplay } from '../../utils/agentOrderUrgencyCopy';
import type { DeliveryOrderViewModel } from '../../orders/model';

type Props = {
  statusLabel: string;
  statusColor: string;
  urgency: DeliveryOrderViewModel['urgency'];
};

/** One status pill and one deliveryUrgency line. */
export function AgentOrderStatusUrgencyRow({ statusLabel, statusColor, urgency }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const line = formatAgentOrderUrgencyDisplay(urgency, new Date(), (key, defaultValue, options) =>
    String(t(key, { defaultValue, ...(options ?? {}) }))
  );
  const tone = line?.overdue ? colors.error.main : colors.warning.main;

  return (
    <View style={[styles.wrap, { gap: spacing.sm, marginBottom: spacing.md }]}>
      <StatusPill
        compact
        label={statusLabel}
        backgroundColor={statusColor + '28'}
        borderColor={statusColor + '55'}
        textColor={colors.text.primary}
        icon="clipboard-text-outline"
      />
      {line ? (
        <View style={[styles.urgency, { gap: spacing.xs }]}>
          <MaterialCommunityIcons
            name={line.overdue ? 'alert' : 'clock-outline'}
            size={16}
            color={tone}
          />
          <Text variant="bodyMedium" style={[styles.urgencyText, { color: tone }]}>
            {line.text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  urgency: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgencyText: {
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
  },
});
