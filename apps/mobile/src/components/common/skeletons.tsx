import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SkeletonBone } from './SkeletonBone';

export function ProductCardSkeleton() {
  const { spacing, borderRadius, colors } = useTheme();
  return (
    <View style={{ width: 160, marginRight: spacing.sm }}>
      <SkeletonBone height={160} borderRadius={borderRadius.card} />
      <SkeletonBone height={14} width="80%" style={{ marginTop: spacing.xs }} />
      <SkeletonBone height={16} width="40%" style={{ marginTop: spacing.xxs, backgroundColor: colors.borderStrong }} />
    </View>
  );
}

export function RailSkeleton() {
  const { spacing } = useTheme();
  return (
    <View style={{ paddingLeft: spacing.md, marginBottom: spacing.lg }}>
      <SkeletonBone height={18} width={140} style={{ marginBottom: spacing.sm }} />
      <View style={styles.row}>
        <ProductCardSkeleton />
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </View>
    </View>
  );
}

export function ListRowSkeleton() {
  const { spacing } = useTheme();
  return (
    <View style={[styles.rowItem, { paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
      <SkeletonBone height={44} width={44} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <SkeletonBone height={14} width="70%" />
        <SkeletonBone height={12} width="40%" style={{ marginTop: spacing.xxs }} />
      </View>
    </View>
  );
}

export function DetailSkeleton() {
  const { spacing, borderRadius } = useTheme();
  return (
    <View>
      <SkeletonBone height={320} borderRadius={0} />
      <View style={{ padding: spacing.md }}>
        <SkeletonBone height={22} width="75%" />
        <SkeletonBone height={28} width="35%" style={{ marginTop: spacing.sm }} />
        <SkeletonBone height={14} width="50%" style={{ marginTop: spacing.sm }} />
        <SkeletonBone height={96} borderRadius={borderRadius.card} style={{ marginTop: spacing.lg }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  rowItem: { flexDirection: 'row', alignItems: 'center' },
});
