import React, { useCallback } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-paper';
import { AgentLocationDisclosureContent } from '../../components/agent/AgentLocationDisclosureContent';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAgentLocation } from '../../contexts/AgentLocationContext';

const PRIVACY_URL = 'https://rendasua.com/privacy';

export default function AgentLocationTrackingScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const { consent, runPermissionFlow } = useAgentLocation();

  const canEnable = consent === 'deferred';

  const handleEnable = useCallback(async () => {
    await runPermissionFlow();
  }, [runPermissionFlow]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.pageBackground }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
        <View
          style={[
            styles.card,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              borderColor: colors.divider,
            },
          ]}
        >
          <AgentLocationDisclosureContent />
        </View>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {canEnable ? (
            <Button mode="contained" onPress={() => void handleEnable()}>
              {t('agent.locationTracking.enableTracking', 'Enable tracking')}
            </Button>
          ) : null}
          <Button mode="outlined" onPress={() => void Linking.openSettings()}>
            {t('agent.locationTracking.openSettings', 'Open device settings')}
          </Button>
          <Button mode="text" onPress={() => void Linking.openURL(PRIVACY_URL)}>
            {t('agent.locationTracking.privacyPolicyLink', 'Privacy Policy')}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: 16, borderWidth: 1 },
});
