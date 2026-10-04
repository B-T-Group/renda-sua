import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { AppText } from '../common/AppText';

export type HomeLane = 'shop' | 'food' | 'rentals';

type Props = {
  value: HomeLane;
  onChange: (lane: HomeLane) => void;
};

const LANES: HomeLane[] = ['shop', 'food', 'rentals'];

export function HomeLaneSwitcher({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const labels: Record<HomeLane, string> = {
    shop: t('client.home.lane.shop', 'Shop'),
    food: t('client.home.lane.food', 'Food'),
    rentals: t('client.home.lane.rentals', 'Rentals'),
  };
  return (
    <View style={[styles.row, { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surfaceInput, borderRadius: borderRadius.button }]}>
      {LANES.map((lane) => {
        const selected = lane === value;
        return (
          <Pressable
            key={lane}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(lane)}
            style={[styles.lane, { backgroundColor: selected ? colors.surface : 'transparent', borderRadius: borderRadius.chip }]}
          >
            <AppText role="label" color={selected ? colors.text.primary : colors.text.muted}>
              {labels[lane]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4 },
  lane: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
});
