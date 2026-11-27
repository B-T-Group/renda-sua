import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { MarketSelector } from '../market/MarketSelector';
import { HomeLaneSwitcher, type HomeLane } from './HomeLaneSwitcher';

type Props = {
  value: HomeLane;
  onChange: (lane: HomeLane) => void;
  /** Optional trailing control (e.g. assistant button) shown beside the market selector. */
  trailing?: ReactNode;
};

/**
 * Shared header for the four browse lanes: one market selector above the lane menu,
 * so individual lane screens never repeat it.
 */
export function HomeLaneHeader({ value, onChange, trailing }: Props) {
  const { spacing } = useTheme();
  return (
    <View>
      <View
        style={[
          styles.marketRow,
          { marginHorizontal: spacing.md, marginBottom: spacing.sm },
        ]}
      >
        <View style={styles.selectorWrap}>
          <MarketSelector catalogContext={value === 'rentals' ? 'rentals' : 'inventory'} />
        </View>
        {trailing}
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
  selectorWrap: { flexShrink: 1, minWidth: 0 },
});
