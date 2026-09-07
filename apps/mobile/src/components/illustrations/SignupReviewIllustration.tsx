import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  size?: number;
  accessibilityLabel: string;
};

function ReviewArt({
  accent,
  paper,
  success,
  size,
}: {
  accent: string;
  paper: string;
  success: string;
  size: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Circle cx="70" cy="70" r="64" fill={accent} opacity={0.08} />
      <Rect
        x="40"
        y="32"
        width="60"
        height="78"
        rx="10"
        fill={paper}
        stroke={accent}
        strokeWidth={2.5}
      />
      <Rect x="56" y="24" width="28" height="16" rx="5" fill={accent} />
      <Circle cx="54" cy="58" r="7" fill={success} />
      <Path
        d="M50.5 58l2.8 2.8 5.2-6"
        stroke={paper}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="54" cy="76" r="7" fill={success} opacity={0.85} />
      <Path
        d="M50.5 76l2.8 2.8 5.2-6"
        stroke={paper}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="54" cy="94" r="7" fill={`${accent}33`} stroke={accent} strokeWidth={2} />
      <Path d="M68 58h22M68 76h18M68 94h14" stroke={accent} strokeWidth={2.5} strokeLinecap="round" opacity={0.35} />
      <Circle cx="104" cy="98" r="18" fill={success} />
      <Path
        d="M96 98l5.5 5.5L113 91"
        stroke={paper}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Checklist + ready badge — last-look visual before account creation. */
export function SignupReviewIllustration({
  size = 120,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const float = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.86)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1700,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={{ opacity, transform: [{ scale }, { translateY }] }}>
        <ReviewArt
          accent={colors.primary.main}
          paper={colors.surface}
          success={colors.success.main}
          size={size}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
