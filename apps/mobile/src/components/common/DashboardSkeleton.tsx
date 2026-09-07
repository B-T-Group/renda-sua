import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { shadows } from '../../theme/shadows';
import { SkeletonBone } from './SkeletonBone';

type Variant = 'business' | 'agent' | 'client';

type Props = {
  variant?: Variant;
  /** Extra list/module rows under the summary card. */
  rows?: number;
};

function SummaryCard() {
  const { colors, borderRadius, spacing } = useTheme();
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
      <SkeletonBone height={14} width="42%" />
      <SkeletonBone height={28} width="58%" style={{ marginTop: spacing.sm }} />
      <View style={[styles.row, { marginTop: spacing.md, gap: spacing.sm }]}>
        <SkeletonBone height={48} width="30%" borderRadius={borderRadius.md} />
        <SkeletonBone height={48} width="30%" borderRadius={borderRadius.md} />
        <SkeletonBone height={48} width="30%" borderRadius={borderRadius.md} />
      </View>
    </View>
  );
}

function ModuleRow() {
  const { colors, borderRadius, spacing } = useTheme();
  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
      ]}
    >
      <SkeletonBone height={40} width={40} borderRadius={borderRadius.sm} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <SkeletonBone height={14} width="72%" />
        <SkeletonBone height={12} width="48%" style={{ marginTop: spacing.xs }} />
      </View>
      <SkeletonBone height={22} width={36} borderRadius={borderRadius.full} />
    </View>
  );
}

export function ListCardSkeleton({ count = 3 }: { count?: number }) {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading', 'Loading...')}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={`list-skel-${i}`}
          style={[
            styles.card,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderColor: colors.divider,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <View style={styles.row}>
            <SkeletonBone height={56} width={56} borderRadius={borderRadius.sm} />
            <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
              <SkeletonBone height={14} width="78%" />
              <SkeletonBone height={12} width="55%" style={{ marginTop: spacing.xs }} />
              <SkeletonBone height={12} width="40%" style={{ marginTop: spacing.xs }} />
            </View>
          </View>
          <SkeletonBone
            height={36}
            width="100%"
            borderRadius={borderRadius.sm}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      ))}
    </View>
  );
}

export const DashboardSkeleton = memo(function DashboardSkeleton({
  variant = 'business',
  rows,
}: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const rowCount = rows ?? (variant === 'client' ? 4 : 3);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading', 'Loading...')}
      style={{ paddingTop: spacing.sm }}
    >
      {variant !== 'client' ? <SummaryCard /> : null}
      {variant === 'agent' ? (
        <View style={{ marginBottom: spacing.md }}>
          <SkeletonBone height={18} width="48%" style={{ marginBottom: spacing.sm }} />
          <ListCardSkeleton count={2} />
        </View>
      ) : null}
      {Array.from({ length: rowCount }, (_, i) => (
        <ModuleRow key={`dash-skel-row-${i}`} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
