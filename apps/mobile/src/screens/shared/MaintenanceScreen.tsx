import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { MaintenanceIllustration } from '../../components/illustrations/MaintenanceIllustration';
import { RotatingCog } from '../../components/illustrations/RotatingCog';
import { checkForUpdateManually } from '../../hooks/useExpoUpdatesOnStartup';

export default function MaintenanceScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [checking, setChecking] = useState(false);

  const onTryAgain = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      await checkForUpdateManually();
    } finally {
      setChecking(false);
    }
  }, [checking]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBackground }]}>
      <View style={[styles.content, { padding: spacing.lg, gap: spacing.md }]}>
        <MaintenanceIllustration />
        <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]}>
          {t('maintenance.title', 'Services unavailable')}
        </Text>
        <Text
          variant="bodyLarge"
          style={{ color: colors.text.secondary, textAlign: 'center' }}
        >
          {t(
            'maintenance.body',
            'Services are unavailable at the moment. Please try again later.'
          )}
        </Text>
        <View style={[styles.updatingRow, { gap: spacing.sm, marginTop: spacing.xs }]}>
          <RotatingCog />
          <Text
            variant="bodyMedium"
            style={[styles.updatingText, { color: colors.text.secondary }]}
          >
            {t(
              'maintenance.updating',
              'We are updating some of our backend services.'
            )}
          </Text>
        </View>
        <Button
          mode="contained"
          onPress={() => void onTryAgain()}
          loading={checking}
          disabled={checking}
          style={{ marginTop: spacing.sm }}
        >
          {t('maintenance.tryAgain', 'Try again')}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontWeight: '700', textAlign: 'center' },
  updatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 320,
  },
  updatingText: { flex: 1, textAlign: 'left' },
});
