import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { haptics } from '@/services/haptics';
import { motion } from '@/theme/motion';
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
  const [width, setWidth] = useState(0);
  const index = Math.max(0, LANES.indexOf(value));
  const offset = useSharedValue(index);
  useEffect(() => {
    offset.value = withTiming(index, { duration: motion.duration.normal });
  }, [index, offset]);
  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: (width / LANES.length) * offset.value }],
  }));
  const labels: Record<HomeLane, string> = {
    shop: t('client.home.lane.shop', 'Shop'),
    food: t('client.home.lane.food', 'Food'),
    rentals: t('client.home.lane.rentals', 'Rentals'),
  };
  const select = (lane: HomeLane) => {
    if (lane !== value) haptics.selection();
    onChange(lane);
  };
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 8)}
      style={[styles.row, { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surfaceInput, borderRadius: borderRadius.button }]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            indicator,
            { width: width / LANES.length, backgroundColor: colors.surface, borderRadius: borderRadius.chip },
          ]}
        />
      ) : null}
      {LANES.map((lane) => (
        <Pressable
          key={lane}
          accessibilityRole="button"
          accessibilityState={{ selected: lane === value }}
          onPress={() => select(lane)}
          style={styles.lane}
        >
          <AppText role="label" color={lane === value ? colors.text.primary : colors.text.muted}>
            {labels[lane]}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4 },
  lane: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', top: 4, bottom: 4, left: 4 },
});
