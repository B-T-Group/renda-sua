import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

export interface ConfirmActionDialogProps {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  loading?: boolean;
  destructive?: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}

/** Cross-platform confirm sheet (Alert.alert is unreliable on web; avoids Paper Dialog borders on iOS). */
export function ConfirmActionDialog({
  visible,
  title,
  message,
  cancelLabel,
  confirmLabel,
  loading,
  destructive,
  onDismiss,
  onConfirm,
}: ConfirmActionDialogProps) {
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
      <Pressable
        style={styles.scrim}
        onPress={loading ? undefined : onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.close', 'Close')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="titleLarge" style={[styles.title, { color: colors.text.primary }]}>
            {title}
          </Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
            <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
              {message}
            </Text>
          </ScrollView>
          <View style={[styles.actions, { paddingHorizontal: spacing.md, gap: spacing.sm }]}>
            <Button onPress={onDismiss} disabled={loading} mode="text" style={styles.actionBtn}>
              {cancelLabel}
            </Button>
            <Button
              mode="contained"
              loading={loading}
              disabled={loading}
              buttonColor={destructive ? colors.error.main : colors.primary.main}
              textColor={colors.onDark}
              onPress={onConfirm}
              style={styles.actionBtn}
            >
              {confirmLabel}
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
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    overflow: 'hidden',
  },
  title: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 16,
  },
  actionBtn: {
    minWidth: 88,
  },
});
