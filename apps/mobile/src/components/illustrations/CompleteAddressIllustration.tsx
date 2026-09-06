import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number };

/** Map pin over a simple place card — complete-your-address teaching visual. */
export function CompleteAddressIllustration({ size = 120 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const secondary = colors.secondary.main;
  const paper = colors.surface;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Complete your address"
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.08} />
        <Rect x="28" y="62" width="64" height="36" rx="8" fill={paper} stroke={primary} strokeWidth={2} />
        <Path d="M36 72 H84" stroke={secondary} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
        <Path d="M36 80 H70" stroke={secondary} strokeWidth={2} strokeLinecap="round" opacity={0.35} />
        <Path
          d="M60 22 C48 22 40 32 40 42 C40 56 60 72 60 72 C60 72 80 56 80 42 C80 32 72 22 60 22 Z"
          fill={primary}
        />
        <Circle cx="60" cy="42" r="8" fill={paper} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
