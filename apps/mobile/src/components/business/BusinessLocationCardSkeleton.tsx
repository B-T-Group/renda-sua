import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { shadows } from '../../theme/shadows';

function BusinessLocationCardSkeletonRow() {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const bone = { backgroundColor: colors.divider };

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading', 'Loading...')}
      style={[
        styles.card,
        shadows.sm,
        {
          borderLeftColor: colors.divider,
          borderColor: colors.divider,
          borderRadius: borderRadius.card,
          backgroundColor: colors.surface,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={[styles.header, { padding: spacing.md, paddingBottom: 0 }]}>
        <View style={[styles.logo, bone, { borderRadius: borderRadius.sm }]} />
        <View style={styles.headerMeta}>
          <View style={[styles.lineTitle, bone, { borderRadius: 4 }]} />
          <View style={[styles.lineSub, bone, { borderRadius: 4, marginTop: spacing.xs }]} />
        </View>
      </View>

      <View style={[styles.badges, { paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>
        <View style={[styles.pill, bone, { borderRadius: borderRadius.full }]} />
        <View style={[styles.pillSm, bone, { borderRadius: borderRadius.full }]} />
        <View style={[styles.pillMd, bone, { borderRadius: borderRadius.full }]} />
      </View>

      <View style={[styles.details, { paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>
        <View style={[styles.lineFull, bone, { borderRadius: 4 }]} />
        <View style={[styles.lineMid, bone, { borderRadius: 4, marginTop: spacing.sm }]} />
        <View style={[styles.lineShort, bone, { borderRadius: 4, marginTop: spacing.sm }]} />
      </View>

      <View
        style={[
          styles.actions,
          {
            borderTopColor: colors.divider,
            marginTop: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <View style={[styles.actionBtn, bone, { borderRadius: borderRadius.sm }]} />
        <View style={[styles.actionBtnWide, bone, { borderRadius: borderRadius.sm }]} />
        <View style={[styles.actionBtn, bone, { borderRadius: borderRadius.sm }]} />
      </View>
    </View>
  );
}

export const BusinessLocationCardSkeleton = memo(function BusinessLocationCardSkeleton({
  count = 3,
}: {
  count?: number;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ padding: spacing.sm, paddingBottom: 88 }}>
      {Array.from({ length: count }, (_, i) => (
        <BusinessLocationCardSkeletonRow key={`location-skeleton-${i}`} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  logo: { width: 56, height: 56, flexShrink: 0 },
  headerMeta: { flex: 1, minWidth: 0, paddingTop: 4 },
  lineTitle: { height: 18, width: '78%' },
  lineSub: { height: 12, width: '48%' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { height: 24, width: 64 },
  pillSm: { height: 24, width: 56 },
  pillMd: { height: 24, width: 72 },
  details: { gap: 2 },
  lineFull: { height: 14, width: '92%' },
  lineMid: { height: 14, width: '70%' },
  lineShort: { height: 14, width: '55%' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: { height: 32, width: 72 },
  actionBtnWide: { height: 32, width: 110 },
});
