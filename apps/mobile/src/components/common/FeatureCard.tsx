import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  title: string;
  message: string;
  illustration?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export function FeatureCard({
  title,
  message,
  illustration,
  actionLabel,
  onAction,
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
  card: { borderWidth: 1 },
  art: { alignItems: 'center' },
});
