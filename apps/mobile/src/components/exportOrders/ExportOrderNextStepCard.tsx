import React from 'react';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { exportOrderNextStepHint } from '../../utils/exportOrders/exportOrderProgress';
import { exportOrderNeedsAction, exportOrderStatusColor } from '../../utils/exportOrders/exportOrderStatus';

interface Props {
  status: string;
  children?: React.ReactNode;
}

export function ExportOrderNextStepCard({ status, children }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const hint = exportOrderNextStepHint(status);
  if (!hint) return null;
  const tone = exportOrderNeedsAction(status)
    ? colors.warning
    : exportOrderStatusColor(status) === 'error'
      ? colors.error
      : colors.primary;
  const key = `exportOrders.next.${status}`;
  return (
    <View
      testID="export-next-step"
      style={{
        padding: spacing.md,
        borderRadius: borderRadius.card,
        backgroundColor: `${tone.main}12`,
        borderWidth: 1,
        borderColor: `${tone.main}40`,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        <MaterialCommunityIcons name={hint.icon as never} size={26} color={tone.main} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleSmall">{t(`${key}.title`, hint.title)}</Text>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {t(`${key}.body`, hint.body)}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}
