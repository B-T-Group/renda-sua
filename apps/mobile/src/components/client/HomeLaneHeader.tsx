import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { MarketSelector } from '../market/MarketSelector';
import { HomeLaneSwitcher, type HomeLane } from './HomeLaneSwitcher';

type Props = {
  value: HomeLane;
  onChange: (lane: HomeLane) => void;
  /** Optional control grouped immediately after the market pill (e.g. notification bell). */
  besideMarket?: ReactNode;
  /** Optional trailing control (e.g. assistant button) shown at the right edge. */
  trailing?: ReactNode;
};

/**
 * Shared header for the four browse lanes: one market selector above the lane menu,
 * so individual lane screens never repeat it.
 */
export function HomeLaneHeader({ value, onChange, besideMarket, trailing }: Props) {
  const { spacing } = useTheme();
  return (
    <View>
      <View
        style={[
          styles.marketRow,
          { marginHorizontal: spacing.md, marginBottom: spacing.sm },
        ]}
      >
        <View
          style={[styles.selectorCluster, { gap: spacing.xs }]}
          testID="home-lane-header-market-cluster"
        >
          <View style={styles.selectorWrap}>
            <MarketSelector catalogContext={value === 'rentals' ? 'rentals' : 'inventory'} />
          </View>
          {besideMarket ? (
            <View style={styles.besideMarket} testID="home-lane-header-bell-slot">
              {besideMarket}
            </View>
          ) : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      <HomeLaneSwitcher value={value} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  selectorCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  selectorWrap: { flexShrink: 1, minWidth: 0 },
  besideMarket: { flexShrink: 0 },
  trailing: { flexShrink: 0 },
});
