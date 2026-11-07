import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  title: string;
  message: string;
  illustration?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
};

export function FeatureCard({
  title,
  message,
  illustration,
  actionLabel,
  onAction,
  onDismiss,
  dismissLabel,
}: Props) {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      {onDismiss ? (
        <IconButton
          icon="close"
          size={18}
          onPress={onDismiss}
          accessibilityLabel={dismissLabel || 'Dismiss'}
          style={styles.dismiss}
          iconColor={colors.text.muted}
        />
      ) : null}
      {illustration ? <View style={styles.art}>{illustration}</View> : null}
      <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
        {title}
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button
          mode="contained-tonal"
          onPress={onAction}
          style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
        >
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, position: 'relative' },
  art: { alignItems: 'center' },
  dismiss: { position: 'absolute', top: 0, right: 0, margin: 0, zIndex: 1 },
});
