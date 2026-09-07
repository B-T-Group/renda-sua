import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { FirstOrderFulfillmentPath } from '../../utils/firstOrderJourney';
import { getClientFirstOrderPreviewSteps } from '../../utils/firstOrderClientJourney';

export function FirstOrderNextStepsPreview({
  fulfillmentPath,
}: {
  fulfillmentPath: FirstOrderFulfillmentPath;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const steps = useMemo(
    () => getClientFirstOrderPreviewSteps(fulfillmentPath),
    [fulfillmentPath]
  );

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.info.main + '55',
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          gap: spacing.sm,
        },
      ]}
      accessibilityRole="summary"
    >
      <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
        {t('client.firstOrder.previewTitle', "Here's what happens next")}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t(
          'client.firstOrder.previewBody',
          'You can follow this path on your order until it is complete.'
        )}
      </Text>
      {steps.map((step, index) => {
        const isCurrent = step.state === 'current';
        return (
          <View key={step.id} style={[styles.row, { gap: spacing.sm }]}>
            <View
              style={[
                styles.badge,
                {
                  borderColor: isCurrent ? colors.primary.main : colors.divider,
                  backgroundColor: isCurrent
                    ? colors.primaryTint ?? colors.primary.main + '22'
                    : colors.background.paper,
                },
              ]}
            >
              <Text
                variant="labelMedium"
                style={{
                  color: isCurrent ? colors.primary.main : colors.text.secondary,
                  fontWeight: '700',
                }}
              >
                {index + 1}
              </Text>
            </View>
            <Text
              variant="bodyMedium"
              style={{
                color: isCurrent ? colors.text.primary : colors.text.secondary,
                flex: 1,
                minWidth: 0,
                fontWeight: isCurrent ? '700' : '400',
              }}
            >
              {t(step.titleKey, step.titleDefault)}
              {isCurrent
                ? ` · ${t('client.firstOrder.previewYouAreHere', 'You are here')}`
                : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
