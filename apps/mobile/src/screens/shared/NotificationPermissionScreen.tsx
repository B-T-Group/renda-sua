import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';

export default function NotificationPermissionScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    status,
    isLoading,
    isGranted,
    isDenied,
    isExpoGoUnsupported,
    requestPermission,
    openSettings,
    checkPermission,
  } = useNotificationPermission();

  const onPrimary = useCallback(async () => {
    if (isDenied) {
      openSettings();
      return;
    }
    await requestPermission();
    await checkPermission();
  }, [checkPermission, isDenied, openSettings, requestPermission]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.lg,
      }}
    >
      <View
        style={[
          styles.hero,
          shadows.sm,
          {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.card,
            padding: spacing.lg,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="bell-ring-outline"
          size={56}
          color={colors.primary.main}
          accessibilityRole="image"
          accessibilityLabel={t('notifications.permission.heroA11y', 'Notifications')}
        />
        <Text variant="headlineSmall" style={{ color: colors.text.primary, marginTop: spacing.md }}>
          {t('notifications.permission.title', 'Stay in the loop')}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: spacing.sm }}>
          {t(
            'notifications.permission.body',
            'Get notified when your rental request is accepted, an order is on its way, or a business needs your action.'
          )}
        </Text>
      </View>

      {isExpoGoUnsupported ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: spacing.lg, textAlign: 'center' }}
        >
          {t(
            'notifications.permission.unsupported',
            'Push notifications require a device build. They are not available in Expo Go or on web.'
          )}
        </Text>
      ) : null}

      {!isExpoGoUnsupported ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Button
            mode="contained"
            loading={isLoading}
            disabled={isLoading || isGranted}
            onPress={() => void onPrimary()}
          >
            {isGranted
              ? t('notifications.permission.enabled', 'Notifications enabled')
              : isDenied
                ? t('notifications.permission.openSettings', 'Open settings')
                : t('notifications.permission.enable', 'Enable notifications')}
          </Button>
          {isGranted ? (
            <Text variant="bodySmall" style={{ color: colors.success.main, textAlign: 'center' }}>
              {t('notifications.permission.grantedHint', 'You will receive alerts for orders and rentals.')}
            </Text>
          ) : null}
          {status ? (
            <Text variant="caption" style={{ color: colors.text.disabled, textAlign: 'center' }}>
              {t('notifications.permission.status', 'Status: {{status}}', { status })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
  },
});
