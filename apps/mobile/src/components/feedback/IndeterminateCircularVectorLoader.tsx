import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const AnimatedView = Animated.createAnimatedComponent(View);

type Props = {
  color: string;
  size?: number;
  strokeWidth?: number;
  running: boolean;
};

/** MUI-style indeterminate ring: vector stroke on a rotating view (native driver). */
export function IndeterminateCircularVectorLoader({
  color,
  size = 56,
  strokeWidth = 3,
  running,
}: Props) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!running) {
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [running, spin]);

  const half = size / 2;
  const r = Math.max(4, half - strokeWidth / 2 - 1);
  const cx = half;
  const cy = half;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * 0.26;

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <AnimatedView style={[styles.wrap, { width: size, height: size, transform: [{ rotate }] }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </Svg>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
