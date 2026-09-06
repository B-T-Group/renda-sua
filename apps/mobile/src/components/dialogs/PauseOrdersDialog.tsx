import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

export type PauseDuration = '15m' | '1h' | 'until_tomorrow' | 'indefinite';

export interface PauseOrdersDialogProps {
  visible: boolean;
  loading?: boolean;
  onDismiss: () => void;
  onSelectDuration: (duration: PauseDuration) => void;
}

const DURATIONS: PauseDuration[] = [
  '15m',
  '1h',
  'until_tomorrow',
  'indefinite',
];

export function PauseOrdersDialog({
  visible,
  loading = false,
  onDismiss,
  onSelectDuration,
}: PauseOrdersDialogProps) {
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
          <Text
            variant="titleLarge"
            style={[styles.title, { color: colors.text.primary }]}
          >
            {t('business.insights.pauseDialog.title', 'Pause receiving orders')}
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              color: colors.text.secondary,
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.md,
            }}
          >
            {t(
              'business.insights.pauseDialog.message',
              'Customers will not be able to place new orders while you are paused.'
            )}
          </Text>
          {loading ? (
            <ActivityIndicator
              style={{ marginVertical: spacing.md }}
              color={colors.primary.main}
            />
          ) : (
            <View
              style={[
                styles.options,
                { paddingHorizontal: spacing.md, gap: spacing.sm },
              ]}
            >
              {DURATIONS.map((duration) => (
                <Button
                  key={duration}
                  mode={duration === 'indefinite' ? 'text' : 'outlined'}
                  disabled={loading}
                  onPress={() => onSelectDuration(duration)}
                >
                  {pauseLabel(t, duration)}
                </Button>
              ))}
            </View>
          )}
          <View style={[styles.cancelRow, { paddingHorizontal: spacing.md }]}>
            <Button mode="text" disabled={loading} onPress={onDismiss}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function pauseLabel(
  t: (key: string, fallback: string) => string,
  duration: PauseDuration
): string {
  if (duration === '15m') {
    return t('businessAvailability.pause15', 'Pause 15 min');
  }
  if (duration === '1h') {
    return t('businessAvailability.pause1h', 'Pause 1 hour');
  }
  if (duration === 'until_tomorrow') {
    return t('businessAvailability.pauseTomorrow', 'Pause until tomorrow');
  }
  return t('businessAvailability.pauseIndefinite', 'Pause indefinitely');
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
    paddingTop: 20,
  },
  title: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  options: {
    width: '100%',
  },
  cancelRow: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
});
