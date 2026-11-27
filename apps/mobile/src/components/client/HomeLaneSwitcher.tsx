import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { haptics } from '@/services/haptics';
import { motion } from '@/theme/motion';
import { AppText } from '../common/AppText';

export type HomeLane = 'rentals' | 'exports' | 'shop' | 'food';

type Props = {
  value: HomeLane;
  onChange: (lane: HomeLane) => void;
};

/** Fixed order shown in every market: Rentals, Exports, Shop, Food. */
export const HOME_LANES: HomeLane[] = ['rentals', 'exports', 'shop', 'food'];

const LANE_ICONS: Record<HomeLane, keyof typeof MaterialCommunityIcons.glyphMap> = {
  rentals: 'hand-coin',
  exports: 'airplane',
  shop: 'shopping',
  food: 'food',
};

export function HomeLaneSwitcher({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, HOME_LANES.indexOf(value));
  const offset = useSharedValue(index);
  useEffect(() => {
    offset.value = withTiming(index, { duration: motion.duration.normal });
  }, [index, offset]);
  const laneCount = HOME_LANES.length;
  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: (width / laneCount) * offset.value }],
  }));
  const labels: Record<HomeLane, string> = {
    rentals: t('client.home.lane.rentals', 'Rentals'),
    exports: t('client.home.lane.exports', 'Exports'),
    shop: t('client.home.lane.shop', 'Shop'),
    food: t('client.home.lane.food', 'Food'),
  };
  const select = (lane: HomeLane) => {
    if (lane !== value) haptics.selection();
    onChange(lane);
  };
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 8)}
      style={[
        styles.row,
        {
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          backgroundColor: colors.surfaceInput,
          borderRadius: borderRadius.button,
        },
      ]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            indicator,
            {
              width: width / laneCount,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.chip,
            },
          ]}
        />
      ) : null}
      {HOME_LANES.map((lane) => (
        <Pressable
          key={lane}
          accessibilityRole="button"
          accessibilityState={{ selected: lane === value }}
          onPress={() => select(lane)}
          style={styles.lane}
        >
          <View style={styles.laneInner}>
            <MaterialCommunityIcons
              name={LANE_ICONS[lane]}
              size={16}
              color={lane === value ? colors.text.primary : colors.text.muted}
            />
            <AppText
              role="label"
              color={lane === value ? colors.text.primary : colors.text.muted}
            >
              {labels[lane]}
            </AppText>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4 },
  lane: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  laneInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  indicator: { position: 'absolute', top: 4, bottom: 4, left: 4 },
});
