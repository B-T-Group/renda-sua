import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 52;
const STROKE = 3.5;

type Anim = {
  displayPercent: number;
  progress: Animated.Value;
  pop: Animated.Value;
};

type Props = Anim;

function ringMetrics() {
  const half = SIZE / 2;
  const r = half - STROKE / 2 - 1;
  return { half, r, circumference: 2 * Math.PI * r };
}

/** Shared count-up + spring for title and ring. */
export function useReadinessPercentAnim(percent: number): Anim {
  const progress = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.86)).current;
  const [displayPercent, setDisplayPercent] = useState(0);
  const target = Math.max(0, Math.min(100, percent));

  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      setDisplayPercent(Math.round(value * 100));
    });
    return () => progress.removeListener(id);
  }, [progress]);

  useEffect(() => {
    pop.setValue(0.92);
    Animated.parallel([
      Animated.timing(progress, {
        toValue: target / 100,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(pop, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pop, progress, target]);

  return { displayPercent, progress, pop };
}

function usePulse(pulse: Animated.Value) {
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
}

export function BusinessStoreReadinessRing({
  displayPercent,
  progress,
  pop,
}: Props) {
  const { colors } = useTheme();
  const { half, r, circumference } = useMemo(ringMetrics, []);
  const pulse = useRef(new Animated.Value(1)).current;
  usePulse(pulse);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <Animated.View
      style={[styles.wrap, { transform: [{ scale: pop }] }]}
      accessibilityRole="image"
      accessibilityLabel={`${displayPercent}%`}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: colors.primaryTint,
            transform: [{ scale: pulse }],
          },
        ]}
      />
      <Svg
        width={SIZE}
        height={SIZE}
        style={[styles.svg, { transform: [{ rotate: '-90deg' }] }]}
      >
        <Circle
          cx={half}
          cy={half}
          r={r}
          stroke={colors.primary.light}
          strokeWidth={STROKE}
          fill="none"
          opacity={0.45}
        />
        <AnimatedCircle
          cx={half}
          cy={half}
          r={r}
          stroke={colors.primary.main}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
        />
      </Svg>
      <Text
        variant="labelMedium"
        style={[styles.label, { color: colors.primary.main }]}
      >
        {displayPercent}%
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SIZE / 2,
    margin: 5,
  },
  svg: {
    position: 'absolute',
  },
  label: {
    fontWeight: '700',
  },
});
