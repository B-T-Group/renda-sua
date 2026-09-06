import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import BiometricService from '../../services/biometric/BiometricService';

export interface EnableBiometricSheetProps {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
  loading?: boolean;
}

export function EnableBiometricSheet({
  visible,
  onEnable,
  onDismiss,
  loading,
}: EnableBiometricSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [biometricLabel, setBiometricLabel] = useState('Face ID');

  useEffect(() => {
    if (!visible) return;
    void BiometricService.getBiometricLabel().then(setBiometricLabel);
  }, [visible]);

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
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryTint }]}>
            <MaterialCommunityIcons name="face-recognition" size={40} color={colors.primary.main} />
          </View>

          <Text variant="titleLarge" style={[styles.title, { color: colors.text.primary }]}>
            {t('savedAccounts.enableBiometric.title', 'Enable {{method}} for faster sign in?', {
              method: biometricLabel,
            })}
          </Text>

          <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center' }}>
            {t(
              'savedAccounts.enableBiometric.body',
              'Biometric unlock only protects access on this device. Your account security still requires your sign-in code when needed.'
            )}
          </Text>

          <View style={[styles.actions, { marginTop: spacing.lg, gap: spacing.sm }]}>
            <Button mode="contained" onPress={onEnable} loading={loading} disabled={loading}>
              {t('savedAccounts.enableBiometric.enable', 'Enable')}
            </Button>
            <Button mode="text" onPress={onDismiss} disabled={loading}>
              {t('savedAccounts.enableBiometric.notNow', 'Not now')}
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
    paddingTop: 28,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 12,
  },
  actions: {
    width: '100%',
  },
});
