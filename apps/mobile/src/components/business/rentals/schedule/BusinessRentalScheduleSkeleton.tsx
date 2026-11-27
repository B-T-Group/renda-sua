import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../contexts/ThemeContext';
import { SkeletonBone } from '../../../common/SkeletonBone';

const PLACEHOLDER_COUNT = 3;

export function BusinessRentalScheduleSkeleton() {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View accessibilityRole="progressbar" testID="schedule-skeleton">
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <View
          key={index}
          style={[
            styles.card,
            { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: spacing.md, gap: spacing.xs, marginBottom: spacing.sm },
          ]}
        >
          <SkeletonBone height={18} width="55%" />
          <SkeletonBone height={14} width="40%" />
          <SkeletonBone height={14} width="70%" />
          <SkeletonBone height={16} width="25%" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
});
