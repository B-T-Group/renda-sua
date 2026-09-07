import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  title: string;
  done: number;
  total: number;
  subtitle?: string;
};

/** Compact progress summary for dashboards / profile. */
export function ProgressCard({ title, done, total, subtitle }: Props) {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const pct = total > 0 ? Math.min(1, done / total) : 0;
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
        },
      ]}
    >
      <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
          {subtitle}
        </Text>
      ) : null}
      <View
        style={[
          styles.track,
          { backgroundColor: colors.divider, marginTop: spacing.sm },
        ]}
      >
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%`, backgroundColor: colors.primary.main },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
