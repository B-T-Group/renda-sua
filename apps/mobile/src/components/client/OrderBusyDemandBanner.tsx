import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  estimatedPrepMinutes: number;
  onWait?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
}

export function OrderBusyDemandBanner({
  estimatedPrepMinutes,
  onWait,
  onCancel,
  showActions = true,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: colors.warning.main + '18',
          borderColor: colors.warning.main + '55',
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
        {t(
          'orders.busy.banner',
          'The merchant is experiencing higher demand than usual. Estimated preparation time: {{minutes}} minutes.',
          { minutes: estimatedPrepMinutes }
        )}
      </Text>
      {showActions ? (
        <View style={styles.actions}>
          {onWait ? (
            <Button mode="contained" onPress={onWait}>
              {t('orders.busy.wait', 'Wait')}
            </Button>
          ) : null}
          {onCancel ? (
            <Button mode="text" onPress={onCancel} textColor={colors.error.main}>
              {t('orders.busy.cancel', 'Cancel')}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
