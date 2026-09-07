import React from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

export interface LogoutAccountSheetProps {
  visible: boolean;
  displayName?: string;
  loading?: boolean;
  onKeepOnDevice: () => void;
  onRemoveCompletely: () => void;
  onDismiss: () => void;
}

export function LogoutAccountSheet({
  visible,
  displayName,
  loading,
  onKeepOnDevice,
  onRemoveCompletely,
  onDismiss,
}: LogoutAccountSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={loading ? undefined : onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="titleLarge" style={[styles.title, { color: colors.text.primary }]}>
            {t('savedAccounts.logout.title', 'Sign out')}
          </Text>

          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {displayName
              ? t(
                  'savedAccounts.logout.subtitleNamed',
                  'Choose what happens to {{name}} on this device.',
                  { name: displayName }
                )
              : t(
                  'savedAccounts.logout.subtitle',
                  'Choose what happens to this account on this device.'
                )}
          </Text>

          <View style={[styles.actions, { marginTop: spacing.lg, gap: spacing.sm }]}>
            <Button mode="contained" onPress={onKeepOnDevice} loading={loading} disabled={loading}>
              {t('savedAccounts.logout.keep', 'Keep on this device')}
            </Button>
            <Button
              mode="outlined"
              textColor={colors.error.main}
              style={{ borderColor: colors.error.main }}
              onPress={onRemoveCompletely}
              disabled={loading}
            >
              {t('savedAccounts.logout.remove', 'Remove completely')}
            </Button>
            <Button mode="text" onPress={onDismiss} disabled={loading}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontWeight: '700',
    marginBottom: 8,
  },
  actions: {
    width: '100%',
  },
});
