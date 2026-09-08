import React, { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { StoreUpdateMode } from '../../utils/resolveStoreUpdatePrompt';
import { openAppStore } from '../../utils/openAppStore';

type Props = {
  visible: boolean;
  mode: StoreUpdateMode | null;
  onDismiss: () => void;
};

export function StoreUpdateModal({ visible, mode, onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isForce = mode === 'force';

  const onUpdate = useCallback(() => {
    void openAppStore();
  }, []);

  if (!mode) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isForce) onDismiss();
      }}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
        onPress={() => {
          if (!isForce) onDismiss();
        }}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: height * 0.8,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            variant="titleLarge"
            style={[typography.h6, { color: colors.text.primary, marginBottom: spacing.sm }]}
          >
            {isForce
              ? t('appUpdate.forceTitle', 'Update required')
              : t('appUpdate.softTitle', 'Update available')}
          </Text>
          <Text style={[typography.body1, { color: colors.text.primary }]}>
            {isForce
              ? t(
                  'appUpdate.forceBody',
                  'This version of Rendasua is no longer supported. Please update to continue.'
                )
              : t(
                  'appUpdate.softBody',
                  'A newer version of Rendasua is available with improvements and fixes.'
                )}
          </Text>
          <View style={[styles.actions, { marginTop: spacing.lg, gap: spacing.sm }]}>
            <Button mode="contained" onPress={onUpdate}>
              {t('appUpdate.update', 'Update app')}
            </Button>
            {!isForce ? (
              <Button mode="text" onPress={onDismiss}>
                {t('appUpdate.later', 'Not now')}
              </Button>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    padding: 20,
  },
  actions: {
    flexDirection: 'column',
  },
});
