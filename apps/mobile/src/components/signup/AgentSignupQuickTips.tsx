import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

const TIP_KEYS = ['step1', 'step2', 'step3'] as const;

export function AgentSignupQuickTips() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          marginBottom: spacing.lg,
        },
      ]}
    >
      <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: spacing.sm }}>
        {t('agentOnboarding.title', 'How Deliveries Work')}
      </Text>
      {TIP_KEYS.map((key) => (
        <View key={key} style={{ marginBottom: spacing.sm }}>
          <Text variant="labelLarge" style={{ fontWeight: '600' }}>
            {t(`agentOnboarding.${key}.title`, key)}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
            {t(`agentOnboarding.${key}.description`, '')}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    padding: 16,
    borderWidth: 1,
  },
});
