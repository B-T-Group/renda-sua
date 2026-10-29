/** #594 addendum §3.1: Agent → Settings → Availability (preferred delivery times). */
import React from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '../../theme/spacing';
import { useSlotPreferences } from '../../hooks/useSlotPreferences';
import PreferredSlotsToggles from '../../components/agent/PreferredSlotsToggles';

export default function AgentAvailabilityScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const state = useSlotPreferences();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background.default }}
      contentContainerStyle={{ padding: spacing.md }}
    >
      <Text variant="titleMedium" accessibilityRole="header" style={{ fontWeight: '600' }}>
        {t('slotPrefs.title')}
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: spacing.xs, marginBottom: spacing.md }}>
        {t('slotPrefs.helper')}
      </Text>
      {state.loading ? (
        <ActivityIndicator />
      ) : state.error && !state.prefs ? (
        <View>
          <Text style={{ color: colors.error.main }}>{t('slotPrefs.loadError')}</Text>
          <Button onPress={state.reload}>{t('dedicatedAgents.retry', 'Retry')}</Button>
        </View>
      ) : (
        <PreferredSlotsToggles state={state} variant="large" />
      )}
      <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.md }}>
        {t('slotPrefs.footnote')}
      </Text>
    </ScrollView>
  );
}
