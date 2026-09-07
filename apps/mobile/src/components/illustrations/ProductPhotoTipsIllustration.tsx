import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  size?: number;
};

/** Three product angles (front / side / back) — photo tips for listing creation. */
export function ProductPhotoTipsIllustration({ size = 168 }: Props) {
  const { colors } = useTheme();
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
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
  const h = Math.round(size * 0.72);

  return (
    <Animated.View
      style={[styles.wrap, { width: size, height: h, transform: [{ translateY }] }]}
      accessibilityRole="image"
      accessibilityLabel="Product photo angles: front, side, and back"
    >
      <Svg width={size} height={h} viewBox="0 0 168 120">
        <Circle cx="84" cy="60" r="54" fill={colors.primary.main} opacity={0.07} />

        {/* Front */}
        <Rect x="18" y="28" width="42" height="54" rx="8" fill={colors.surface} />
        <Rect
          x="18"
          y="28"
          width="42"
          height="54"
          rx="8"
          stroke={colors.primary.main}
          strokeWidth={2}
          fill="none"
        />
        <Rect x="28" y="40" width="22" height="28" rx="4" fill={colors.primary.main} opacity={0.75} />
        <Circle cx="39" cy="48" r="4" fill={colors.surface} opacity={0.9} />
        <Path
          d="M30 64 L36 56 L42 62 L48 52 L50 68 L30 68 Z"
          fill={colors.surface}
          opacity={0.85}
        />

        {/* Side */}
        <Rect x="66" y="22" width="36" height="54" rx="8" fill={colors.surface} />
        <Rect
          x="66"
          y="22"
          width="36"
          height="54"
          rx="8"
          stroke={colors.info.main}
          strokeWidth={2}
          fill="none"
        />
        <Rect x="78" y="34" width="12" height="30" rx="3" fill={colors.info.main} opacity={0.8} />
        <Path
          d="M72 70 Q84 64 96 70"
          stroke={colors.info.main}
          strokeWidth={2}
          fill="none"
          opacity={0.5}
        />

        {/* Back */}
        <Rect x="110" y="28" width="42" height="54" rx="8" fill={colors.surface} />
        <Rect
          x="110"
          y="28"
          width="42"
          height="54"
          rx="8"
          stroke={colors.secondary.main}
          strokeWidth={2}
          fill="none"
        />
        <Rect
          x="120"
          y="40"
          width="22"
          height="28"
          rx="4"
          fill={colors.secondary.main}
          opacity={0.55}
        />
        <Rect x="126" y="48" width="10" height="4" rx="1" fill={colors.surface} />
        <Rect x="126" y="56" width="10" height="3" rx="1" fill={colors.surface} opacity={0.7} />

        {/* Soft ground shadow */}
        <Path
          d="M30 96 Q84 108 140 96"
          stroke={colors.text.secondary}
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.12}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
