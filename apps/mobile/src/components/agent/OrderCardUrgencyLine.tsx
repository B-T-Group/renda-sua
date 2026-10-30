import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { DeliveryOrderViewModel } from '../../orders/model';

interface Props {
  urgency: DeliveryOrderViewModel['urgency'];
}

/** Clock-first pickup-by / deliver-by line for Active Orders cards. */
export function OrderCardUrgencyLine({ urgency }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!urgency?.deadlineAt) return null;
  const overdue = urgency.overdue;
  const tone = overdue ? colors.error.main : colors.warning.main;
  const label = overdue
    ? t('orders.countdown.overdue', 'Overdue')
    : urgency.label;
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons
        name={overdue ? 'alert' : 'clock-outline'}
        size={14}
        color={tone}
      />
      <Text variant="bodySmall" style={[styles.label, { color: tone }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
  },
});
