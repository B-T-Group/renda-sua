import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { SkeletonBone } from '../common/SkeletonBone';

function CatalogItemSkeletonRow() {
  const { colors, borderRadius, spacing } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: borderRadius.md,
          backgroundColor: colors.surface,
          borderColor: colors.divider,
        },
      ]}
    >
      <View style={styles.hero}>
        <SkeletonBone
          height={1}
          width="100%"
          borderRadius={0}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      <View style={[styles.body, { padding: spacing.sm }]}>
        <SkeletonBone height={16} width="88%" />
        <SkeletonBone
          height={14}
          width="62%"
          style={{ marginTop: spacing.xs }}
        />
        <SkeletonBone
          height={12}
          width="44%"
          style={{ marginTop: spacing.sm }}
        />
        <SkeletonBone
          height={40}
          width="100%"
          borderRadius={borderRadius.sm}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </View>
  );
}

export const CatalogItemSkeleton = memo(function CatalogItemSkeleton({
  count = 6,
}: {
  count?: number;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading', 'Loading...')}
      style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}
    >
      {Array.from({ length: count }, (_, i) => (
        <CatalogItemSkeletonRow key={`catalog-skeleton-${i}`} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
  },
  body: { minWidth: 0 },
});
