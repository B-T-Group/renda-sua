import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  /** Increment or change when the success animation should replay. */
  playToken: number;
  size?: number;
};

export function SuccessDeliveryVector({ playToken, size = 96 }: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.35)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (playToken <= 0) return;
    scale.setValue(0.35);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [playToken, opacity, scale]);

  const fg = colors.primary?.contrast ?? '#ffffff';

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="Success">
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Svg width={size} height={size} viewBox="0 0 96 96">
          <Circle cx="48" cy="48" r="40" fill={colors.success.main} opacity={0.2} />
          <Circle cx="48" cy="48" r="32" fill={colors.success.main} />
          <Path
            d="M30 49 L44 63 L68 35"
            stroke={fg}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
