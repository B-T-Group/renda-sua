import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

/** Theme-aware celebration vector for first-order merchant onboarding. */
export function FirstOrderOnboardingIllustration({ size = 120 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const secondary = colors.secondary?.main ?? colors.info.main;
  const paper = colors.surface;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="First order celebration"
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.12} />
        <Rect x="30" y="40" width="60" height="44" rx="8" fill={primary} />
        <Path d="M30 52 H90" stroke={paper} strokeWidth={2} opacity={0.35} />
        <Rect x="42" y="60" width="24" height="6" rx="3" fill={paper} opacity={0.75} />
        <Rect x="42" y="72" width="36" height="6" rx="3" fill={paper} opacity={0.45} />
        <Circle cx="88" cy="34" r="16" fill={secondary} />
        <Path
          d="M82 34 L86 38 L94 28"
          stroke={paper}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
