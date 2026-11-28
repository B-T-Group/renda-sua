import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { SkeletonBone } from '../common/SkeletonBone';
import { LANE_ICONS } from '../client/homeLaneIcons';
import type { MarketLaneCounts } from '../../hooks/useMarketPickerCounts';
import { formatMarketCount, formatMarketCountExact } from '../../utils/formatMarketCount';

export type MarketCountLane = keyof MarketLaneCounts;

/** Lane order matches the lane switcher: Rentals, Exports, Shop. */
export const MARKET_COUNT_LANES: MarketCountLane[] = ['rentals', 'exports', 'shop'];

const LABEL_KEYS: Record<MarketCountLane, { key: string; fallback: string }> = {
  rentals: { key: 'client.home.lane.rentals', fallback: 'Rentals' },
  exports: { key: 'client.home.lane.exports', fallback: 'Exports' },
  shop: { key: 'client.home.lane.shop', fallback: 'Shop' },
};

const A11Y_KEYS: Record<MarketCountLane, { key: string; fallback: string }> = {
  rentals: { key: 'market.picker.a11y.rentals', fallback: '{{formatted}} rentals' },
  exports: { key: 'market.picker.a11y.exports', fallback: '{{formatted}} exports' },
  shop: { key: 'market.picker.a11y.items', fallback: '{{formatted}} items' },
};

export interface MarketCountsStripProps {
  /** null while loading (numbers shimmer). */
  counts: MarketLaneCounts | null;
  loading: boolean;
  /** Lane the user is in; null for Food (no cell highlighted). */
  activeLane: MarketCountLane | null;
}

/**
 * Three-cell strip shown above "All of X" inside an opened market: icon, number and a
 * small label per lane. The active lane is filled blue and bold; a zero stays visible
 * but muted so the strip always has three cells. Hidden by the caller when a count
 * call failed.
 */
export function MarketCountsStrip({ counts, loading, activeLane }: MarketCountsStripProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const language = i18n.language;

  return (
    <View
      testID="market-counts-strip"
      style={[styles.strip, { gap: 6, marginBottom: spacing.sm }]}
    >
      {MARKET_COUNT_LANES.map((lane) => {
        const label = t(LABEL_KEYS[lane].key, LABEL_KEYS[lane].fallback);
        const value = counts?.[lane] ?? 0;
        const active = activeLane === lane;
        const zero = !loading && value === 0;
        const accent = active ? colors.primary.main : zero ? colors.text.muted : colors.text.primary;
        const a11yLabel = loading
          ? label
          : t(A11Y_KEYS[lane].key, A11Y_KEYS[lane].fallback, {
              count: value,
              formatted: formatMarketCountExact(value, language),
            });
        return (
          <View
            key={lane}
            testID={`market-count-${lane}`}
            accessible
            accessibilityRole="text"
            accessibilityLabel={a11yLabel}
            accessibilityState={{ selected: active }}
            style={[
              styles.cell,
              {
                backgroundColor: active ? colors.primaryTint : colors.surfaceInput,
                borderRadius: borderRadius.md,
                paddingVertical: spacing.xs + 2,
                paddingHorizontal: 2,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={LANE_ICONS[lane]}
              size={17}
              color={active ? colors.primary.main : zero ? colors.text.disabled : colors.text.muted}
            />
            {loading ? (
              <SkeletonBone height={14} width={30} borderRadius={4} style={styles.shimmer} />
            ) : (
              <Text
                variant="titleSmall"
                numberOfLines={1}
                style={[styles.number, { color: accent, fontWeight: active ? '700' : '500' }]}
              >
                {formatMarketCount(value, language)}
              </Text>
            )}
            <Text
              variant="labelSmall"
              numberOfLines={1}
              style={[
                styles.label,
                {
                  color: active ? colors.primary.main : colors.text.muted,
                  fontWeight: active ? '700' : '400',
                },
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 1 },
  number: { fontSize: 15, lineHeight: 20 },
  label: { fontSize: 10, lineHeight: 13, letterSpacing: 0, textAlign: 'center' },
  shimmer: { marginVertical: 3 },
});
